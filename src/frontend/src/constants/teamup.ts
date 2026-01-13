/**
 * Shared constants for TeamUp functionality
 */

export const SPORT_TYPES = [
  '⚽ Soccer (Football)',
  '🏀 Basketball',
  '🏏 Cricket',
  '🏈 American Football',
  '🏒 Ice Hockey',
  '⚾ Baseball',
  '🏐 Volleyball',
  '🏉 Rugby',
  '🤾 Handball',
  '🏑 Field Hockey',
  'Tennis',
  'Running',
  'Cycling',
  'Swimming',
  'Other',
] as const;

export const SKILL_LEVELS = ['any', 'beginner', 'intermediate', 'advanced'] as const;

export type SportType = typeof SPORT_TYPES[number];
export type SkillLevel = typeof SKILL_LEVELS[number];
