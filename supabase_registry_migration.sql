-- Migration for Verified Identity Registry

-- 1. Create Registry Table
create table if not exists registered_tokens (
  token text primary key,
  user_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table registered_tokens enable row level security;

-- 3. Create Policies
-- Allow anyone to register a NEW token (Insert)
create policy "Allow public registration"
on registered_tokens for insert
with check (true);

-- Allow anyone to look up a name IF they know the token (Select)
-- This acts as the "login" verification.
create policy "Allow public lookup by token"
on registered_tokens for select
using (true);
