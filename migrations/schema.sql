-- Enable required extensions
create extension if not exists pgcrypto;

-- Main threads table
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  share_id text unique default encode(gen_random_bytes(9), 'base64'),
  content text not null,
  concepts text[] not null,
  thread_data jsonb not null,
  
  -- Analytics
  participant_count integer,
  message_count integer,
  action_items_count integer,
  
  -- Status
  status text default 'pending',
  error_log jsonb,
  
  -- Timestamps
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

-- Indexes
create index threads_concepts_idx on threads using gin (concepts);
create index threads_thread_data_idx on threads using gin (thread_data);
create index threads_created_at_idx on threads (created_at);
create index threads_share_id_idx on threads (share_id);

-- Update thread analytics function (unchanged)
create or replace function update_thread_analytics()
returns trigger as $$
begin
  -- Update participant count
  new.participant_count := (
    select count(distinct p.who)
    from jsonb_array_elements(new.thread_data->'discussion'->'threads') as t
    cross join lateral (
      select who from jsonb_array_elements(t->'responses') as r, jsonb_to_record(r) as x(who text)
      union
      select who from jsonb_to_record(t->'initiator') as i(who text)
    ) p
  );

  -- Update message count
  new.message_count := (
    select count(*)
    from jsonb_array_elements(new.thread_data->'discussion'->'threads') as t,
    jsonb_array_elements(t->'responses')
  ) + (
    select count(*)
    from jsonb_array_elements(new.thread_data->'discussion'->'threads')
  );

  -- Update action items count
  new.action_items_count := jsonb_array_length(new.thread_data->'discussion'->'action_items');

  return new;
end;
$$ language plpgsql;

-- Trigger for analytics updates
create trigger update_thread_analytics_trigger
  before insert or update of thread_data on threads
  for each row
  execute function update_thread_analytics();


  -- Enable RLS on the threads table
alter table threads enable row level security;

-- Policy to allow everyone to select (view) data
create policy select_policy on threads
  for select
  using (true);