-- 投稿者のブロック（App Store / Google Play の UGC 要件：不快な利用者をブロックできること）
-- ・ブロックした人の口コミ・写真は、ブロックした本人にだけ表示されなくなる
-- ・投稿者のIDは利用者に見せない（投稿IDから運営側の関数で投稿者を特定する）
-- ・どちらかがアカウントを削除するとブロックの記録も消える

create table private.ugc_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table private.ugc_blocks enable row level security;
revoke all on private.ugc_blocks from anon, authenticated;

-- RLS の条件から呼ぶ判定関数（API には公開しないスキーマに置く）
create schema if not exists ugc_rls;
revoke all on schema ugc_rls from public;
grant usage on schema ugc_rls to anon, authenticated;
create or replace function ugc_rls.blocked_by_me(p_author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from private.ugc_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_author)
$$;
revoke all on function ugc_rls.blocked_by_me(uuid) from public;
grant execute on function ugc_rls.blocked_by_me(uuid) to anon, authenticated;

-- 公開中の口コミ・写真の読み取り条件に「自分がブロックした人の投稿ではない」を加える
drop policy reviews_read_public on public.place_reviews;
create policy reviews_read_public on public.place_reviews for select to anon, authenticated
  using (status = 'approved'
         and not ugc_rls.blocked_by_me(author_id)
         and exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));
drop policy photos_read_public on public.place_photos;
create policy photos_read_public on public.place_photos for select to anon, authenticated
  using (status = 'approved' and uploaded
         and not ugc_rls.blocked_by_me(uploader_id)
         and exists (select 1 from public.places p where p.id = place_id and p.publication_status = 'published'));

create or replace function public.block_ugc_author(p_target_type text, p_target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  if p_target_type = 'review' then
    select author_id into v_author from public.place_reviews where id = p_target_id and status = 'approved';
  elsif p_target_type = 'photo' then
    select uploader_id into v_author from public.place_photos where id = p_target_id and status = 'approved' and uploaded;
  else
    raise exception 'validation:target' using errcode = '22023';
  end if;
  if v_author is null then raise exception 'validation:target' using errcode = '22023'; end if;
  if v_author = v_uid then raise exception 'validation:self' using errcode = '22023'; end if;
  -- 通報と同じ1日の上限を使う（大量のブロックで負荷をかけさせない）
  perform private.consume_ugc_quota(v_uid, 'flag', private.setting_int('flag_daily_limit', 20));
  insert into private.ugc_blocks (blocker_id, blocked_id) values (v_uid, v_author)
  on conflict (blocker_id, blocked_id) do nothing;
end $$;

create or replace function public.unblock_all_ugc_authors() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '28000'; end if;
  delete from private.ugc_blocks where blocker_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.block_ugc_author(text, uuid) from public, anon;
revoke all on function public.unblock_all_ugc_authors() from public, anon;
grant execute on function public.block_ugc_author(text, uuid) to authenticated;
grant execute on function public.unblock_all_ugc_authors() to authenticated;
