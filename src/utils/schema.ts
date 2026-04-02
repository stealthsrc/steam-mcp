import { z } from 'zod';

// SteamID64: must be exactly 17 digits starting with 7656119
// CRITICAL: must remain a string — JS number loses precision for SteamID64 values
export const steamIdSchema = z
  .string()
  .regex(/^7656119[0-9]{10}$/, 'Invalid SteamID64 format. Expected 17-digit number starting with 7656119.');

// Accepts either a SteamID64 or a vanity URL (alphanumeric + hyphens, 2–32 chars)
export const steamIdOrVanitySchema = z
  .string()
  .min(1, 'steamid is required')
  .refine(
    (v) => /^7656119[0-9]{10}$/.test(v) || /^[a-zA-Z0-9_-]{2,32}$/.test(v),
    'Must be a SteamID64 (17 digits) or a vanity URL (2–32 alphanumeric characters)'
  );

export const appIdSchema = z
  .union([z.string().regex(/^\d+$/, 'appid must be numeric'), z.number().int().positive()])
  .transform((v) => String(v));

export const languageSchema = z
  .string()
  .regex(/^[a-z]{2,20}$/, 'Language must be a lowercase string (e.g. "english", "french", "en")')
  .default('english');
