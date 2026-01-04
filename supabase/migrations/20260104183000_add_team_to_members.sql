-- Add team column to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS team text DEFAULT '';
