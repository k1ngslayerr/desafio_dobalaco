-- Add optional second photo to submissions
alter table public.submissions
  add column if not exists photo_url_2 text;
