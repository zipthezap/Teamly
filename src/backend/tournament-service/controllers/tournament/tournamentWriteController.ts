import { Request, Response } from 'express';

import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import * as tournamentService from '../../../services/tournamentService';
import { TournamentFormat } from '../../../../shared/types/tournament.types';
import { BadRequestError, ForbiddenError } from '../../../utils/errors';
import { isRequired, isValidEmail, parseCoordinates, sanitizeString } from '../../../utils/validation';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import { parseEnumInput } from './_requestValidators';
import {
  DEFAULT_FORFEIT_SCORE_AGAINST,
  DEFAULT_FORFEIT_SCORE_FOR,
  MAX_DESCRIPTION_LENGTH,
  MAX_LOCATION_FIELD_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TEAMS_UPPER_BOUND,
  TOURNAMENT_CONTINGENCY_MODES,
  TOURNAMENT_SEEDING_POLICIES,
} from './_constants';
import {
  assertValidTournamentTimezone,
  parseBoolean,
  parseIntegerInRange,
  parseNonNegativeInteger,
  parsePlayoffSize,
} from './_helpers';
import {
  assertSupportedTournamentFormat,
  assertTournamentSetupEditable,
  MAX_MIN_TEAM_REST_MINUTES,
  parseOptionalDate,
  validateSportConfigShape,
  validateTiebreakerRules,
} from './tournamentCoreController';

export const createTournament = async (req: Request, res: Response) => {
  const {
    name,
    description,
    sportType,
    format,
    startDate,
    endDate,
    maxTeams,
    location,
    latitude,
    longitude,
    locationName,
    city,
    country,
    groupId,
    registrationDeadline,
    registrationStartDate,
    isPublic,
    allowLateRegistration,
    autoGenerateBrackets,
    useManualBrackets,
    prizesDescription,
    rulesDescription,
    contactEmail,
    sportConfig,
    isRecurring,
    recurrenceRule,
    registrationFee,
    requirePaymentForBrackets,
    paymentInfo,
    requireWaiverForRegistration,
    waiverText,
    rosterLockDate,
    paymentDeadline,
    tiebreakerRules,
    selfRefEnabled,
    timezone,
    noShowGraceMinutes,
    noShowAutoForfeit,
    forfeitScoreFor,
    forfeitScoreAgainst,
    minTeamRestMinutes,
    withdrawalDeadline,
    autoPromoteRegistrationWaitlist,
    rescheduleCutoffMinutes,
    allowRescheduleAfterStart,
    seedingPolicy,
    seedsLockedAt,
    playoffSize,
    doubleElimination,
    enableThirdPlaceMatch,
    enableConsolationBracket,
    allowByes,
    contingencyMode,
    contingencyNotes,
    contingencyDelayMinutes,
  } = req.body;

  const userId = req.user!.id;

  isRequired(name, 'Name');
  isRequired(sportType, 'Sport type');
  isRequired(format, 'Format');
  isRequired(startDate, 'Start date');

  tournamentService.validateTournamentEnums({ sportType, format });
  assertSupportedTournamentFormat(format);

  const sanitized = tournamentService.sanitizeTournamentData({
    name,
    description,
    location,
    locationName,
    prizesDescription,
    rulesDescription,
    paymentInfo,
    waiverText,
  });

  if (!sanitized.name) {
    throw new BadRequestError('Name cannot be empty or whitespace-only');
  }
  if (sanitized.name.length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (sanitized.description && sanitized.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new BadRequestError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  if (maxTeams !== undefined && maxTeams !== null) {
    if (maxTeams > MAX_TEAMS_UPPER_BOUND) {
      throw new BadRequestError(`Max teams cannot exceed ${MAX_TEAMS_UPPER_BOUND}`);
    }
  }

  const dateValidation = tournamentService.validateTournamentDates(startDate, endDate);
  if (!dateValidation.valid) {
    throw new BadRequestError(dateValidation.error!);
  }
  tournamentService.validateTournamentBusinessRules({
    startDate,
    endDate,
    registrationStartDate,
    registrationDeadline,
    maxTeams,
  });

  if (contactEmail) {
    if (!isValidEmail(contactEmail)) {
      throw new BadRequestError('Invalid contact email format');
    }
  }

  if (isPublic !== undefined && typeof isPublic !== 'boolean') {
    throw new BadRequestError('isPublic must be a boolean');
  }

  if (city !== undefined && city !== null && typeof city === 'string' && city.length > MAX_LOCATION_FIELD_LENGTH) {
    throw new BadRequestError(`City must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
  }
  if (country !== undefined && country !== null && typeof country === 'string' && country.length > MAX_LOCATION_FIELD_LENGTH) {
    throw new BadRequestError(`Country must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
  }

  validateSportConfigShape(sportConfig);

  const normalizedTimezone =
    timezone !== undefined && timezone !== null ? assertValidTournamentTimezone(timezone) : undefined;

  if (noShowGraceMinutes !== undefined) parseNonNegativeInteger(noShowGraceMinutes, 'noShowGraceMinutes');
  if (minTeamRestMinutes !== undefined) {
    parseIntegerInRange(minTeamRestMinutes, 'minTeamRestMinutes', 0, MAX_MIN_TEAM_REST_MINUTES);
  }
  if (rescheduleCutoffMinutes !== undefined) parseNonNegativeInteger(rescheduleCutoffMinutes, 'rescheduleCutoffMinutes');
  if (contingencyDelayMinutes !== undefined) parseNonNegativeInteger(contingencyDelayMinutes, 'contingencyDelayMinutes');
  if (registrationFee !== undefined && registrationFee !== null && Number(registrationFee) < 0) {
    throw new BadRequestError('registrationFee must be a non-negative number');
  }

  if (noShowAutoForfeit !== undefined) parseBoolean(noShowAutoForfeit, 'noShowAutoForfeit');
  if (autoPromoteRegistrationWaitlist !== undefined) {
    parseBoolean(autoPromoteRegistrationWaitlist, 'autoPromoteRegistrationWaitlist');
  }
  if (allowRescheduleAfterStart !== undefined) parseBoolean(allowRescheduleAfterStart, 'allowRescheduleAfterStart');
  if (enableThirdPlaceMatch !== undefined) parseBoolean(enableThirdPlaceMatch, 'enableThirdPlaceMatch');
  if (enableConsolationBracket !== undefined) parseBoolean(enableConsolationBracket, 'enableConsolationBracket');
  if (allowByes !== undefined) parseBoolean(allowByes, 'allowByes');

  const parsedForfeitScoreFor =
    forfeitScoreFor !== undefined ? parseNonNegativeInteger(forfeitScoreFor, 'forfeitScoreFor') : undefined;
  const parsedForfeitScoreAgainst =
    forfeitScoreAgainst !== undefined ? parseNonNegativeInteger(forfeitScoreAgainst, 'forfeitScoreAgainst') : undefined;
  if (
    parsedForfeitScoreFor !== undefined &&
    parsedForfeitScoreAgainst !== undefined &&
    parsedForfeitScoreFor <= parsedForfeitScoreAgainst
  ) {
    throw new BadRequestError('forfeitScoreFor must be greater than forfeitScoreAgainst');
  }

  const normalizedSeedingPolicy =
    seedingPolicy !== undefined
      ? parseEnumInput(seedingPolicy, TOURNAMENT_SEEDING_POLICIES, 'seedingPolicy')
      : undefined;
  const normalizedPlayoffSize = playoffSize !== undefined ? parsePlayoffSize(playoffSize) : undefined;
  const normalizedContingencyMode =
    contingencyMode !== undefined
      ? parseEnumInput(contingencyMode, TOURNAMENT_CONTINGENCY_MODES, 'contingencyMode')
      : undefined;
  const normalizedTiebreakerRules = validateTiebreakerRules(tiebreakerRules);

  if (withdrawalDeadline !== undefined && withdrawalDeadline !== null && Number.isNaN(new Date(withdrawalDeadline).getTime())) {
    throw new BadRequestError('withdrawalDeadline must be a valid date');
  }
  if (seedsLockedAt !== undefined && seedsLockedAt !== null && Number.isNaN(new Date(seedsLockedAt).getTime())) {
    throw new BadRequestError('seedsLockedAt must be a valid date');
  }
  const parsedStartDate = parseOptionalDate(startDate, 'startDate');
  const parsedPaymentDeadline = parseOptionalDate(paymentDeadline, 'paymentDeadline');
  const parsedRosterLockDate = parseOptionalDate(rosterLockDate, 'rosterLockDate');
  if (parsedPaymentDeadline && parsedStartDate && parsedPaymentDeadline > parsedStartDate) {
    throw new BadRequestError('paymentDeadline must be on or before startDate');
  }
  if (parsedRosterLockDate && parsedStartDate && parsedRosterLockDate >= parsedStartDate) {
    throw new BadRequestError('rosterLockDate must be before startDate');
  }

  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    parseCoordinates(latitude, longitude);
  }

  if (groupId) {
    const groupMember = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId
        }
      }
    });

    if (!groupMember || groupMember.role !== 'admin') {
      throw new ForbiddenError('Only group admins can create tournaments for the group');
    }
  }

  const coordinates =
    latitude !== undefined &&
    longitude !== undefined &&
    latitude !== null &&
    longitude !== null
      ? parseCoordinates(latitude, longitude)
      : null;

  const tournament = await prisma.tournament.create({
    data: {
      name: sanitized.name,
      description: sanitized.description || undefined,
      sportType,
      format: format as TournamentFormat,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      maxTeams,
      location: sanitized.location || undefined,
      latitude: coordinates?.lat ?? undefined,
      longitude: coordinates?.lon ?? undefined,
      locationName: sanitized.locationName || undefined,
      city: city ? sanitizeString(city) : undefined,
      country: country ? sanitizeString(country) : undefined,
      organizerId: userId,
      groupId: groupId || undefined,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
      registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
      isPublic: isPublic !== undefined ? isPublic : true,
      allowLateRegistration: allowLateRegistration || false,
      autoGenerateBrackets: autoGenerateBrackets || false,
      useManualBrackets: useManualBrackets || false,
      prizesDescription: sanitized.prizesDescription || undefined,
      rulesDescription: sanitized.rulesDescription || undefined,
      contactEmail: contactEmail || undefined,
      sportConfig: sportConfig || undefined,
      isRecurring: isRecurring || false,
      recurrenceRule: recurrenceRule || undefined,
      registrationFee: registrationFee != null ? Number(registrationFee) : undefined,
      requirePaymentForBrackets: requirePaymentForBrackets || false,
      paymentInfo: sanitized.paymentInfo || undefined,
      requireWaiverForRegistration: requireWaiverForRegistration || false,
      waiverText: sanitized.waiverText || undefined,
      rosterLockDate: parsedRosterLockDate ?? undefined,
      paymentDeadline: parsedPaymentDeadline ?? undefined,
      tiebreakerRules: normalizedTiebreakerRules && normalizedTiebreakerRules.length > 0 ? normalizedTiebreakerRules : undefined,
      selfRefEnabled: selfRefEnabled || false,
      timezone: normalizedTimezone,
      noShowGraceMinutes:
        noShowGraceMinutes !== undefined ? parseNonNegativeInteger(noShowGraceMinutes, 'noShowGraceMinutes') : undefined,
      noShowAutoForfeit: noShowAutoForfeit !== undefined ? parseBoolean(noShowAutoForfeit, 'noShowAutoForfeit') : undefined,
      forfeitScoreFor: parsedForfeitScoreFor,
      forfeitScoreAgainst: parsedForfeitScoreAgainst,
      minTeamRestMinutes:
        minTeamRestMinutes !== undefined ? parseNonNegativeInteger(minTeamRestMinutes, 'minTeamRestMinutes') : undefined,
      withdrawalDeadline: withdrawalDeadline ? new Date(withdrawalDeadline) : undefined,
      autoPromoteRegistrationWaitlist:
        autoPromoteRegistrationWaitlist !== undefined
          ? parseBoolean(autoPromoteRegistrationWaitlist, 'autoPromoteRegistrationWaitlist')
          : undefined,
      rescheduleCutoffMinutes:
        rescheduleCutoffMinutes !== undefined
          ? parseNonNegativeInteger(rescheduleCutoffMinutes, 'rescheduleCutoffMinutes')
          : undefined,
      allowRescheduleAfterStart:
        allowRescheduleAfterStart !== undefined
          ? parseBoolean(allowRescheduleAfterStart, 'allowRescheduleAfterStart')
          : undefined,
      seedingPolicy: normalizedSeedingPolicy,
      seedsLockedAt: seedsLockedAt ? new Date(seedsLockedAt) : undefined,
      playoffSize: normalizedPlayoffSize,
      doubleElimination:
        doubleElimination !== undefined ? parseBoolean(doubleElimination, 'doubleElimination') : undefined,
      enableThirdPlaceMatch:
        enableThirdPlaceMatch !== undefined ? parseBoolean(enableThirdPlaceMatch, 'enableThirdPlaceMatch') : undefined,
      enableConsolationBracket:
        enableConsolationBracket !== undefined
          ? parseBoolean(enableConsolationBracket, 'enableConsolationBracket')
          : undefined,
      allowByes: allowByes !== undefined ? parseBoolean(allowByes, 'allowByes') : undefined,
      contingencyMode: normalizedContingencyMode,
      contingencyNotes:
        contingencyNotes !== undefined && contingencyNotes !== null
          ? sanitizeString(String(contingencyNotes))
          : undefined,
      contingencyDelayMinutes:
        contingencyDelayMinutes !== undefined
          ? parseNonNegativeInteger(contingencyDelayMinutes, 'contingencyDelayMinutes')
          : undefined,
    },
    include: {
      organizer: {
        select: { id: true, name: true, email: true }
      },
      group: {
        select: { id: true, name: true }
      }
    }
  });

  logger.info('Tournament created', 'TournamentController', {
    tournamentId: tournament.id,
    userId,
    isRecurring: tournament.isRecurring
  });

  res.status(201).json(tournament);
};

/**
 * Update a tournament
 */
export const updateTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const {
    name, description, status, startDate, endDate, maxTeams, sportType, format,
    location, locationName, city, country, latitude, longitude,
    registrationDeadline, registrationStartDate, isPublic, allowLateRegistration,
    autoGenerateBrackets, useManualBrackets, prizesDescription, rulesDescription, contactEmail,
    sportConfig,
    registrationFee, requirePaymentForBrackets, paymentInfo,
    requireWaiverForRegistration, waiverText,
    rosterLockDate, paymentDeadline, tiebreakerRules,
    selfRefEnabled,
    timezone,
    noShowGraceMinutes,
    noShowAutoForfeit,
    forfeitScoreFor,
    forfeitScoreAgainst,
    minTeamRestMinutes,
    withdrawalDeadline,
    autoPromoteRegistrationWaitlist,
    rescheduleCutoffMinutes,
    allowRescheduleAfterStart,
    seedingPolicy,
    seedsLockedAt,
    playoffSize,
    doubleElimination,
    enableThirdPlaceMatch,
    enableConsolationBracket,
    allowByes,
    contingencyMode,
    contingencyNotes,
    contingencyDelayMinutes,
  } = req.body;

  let tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  ensureResourceExists(tournament, 'Tournament');

  tournament = await tournamentService.syncTournamentAutoStatus(tournament!, 'update_precheck');

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can update the tournament');
  }

  assertTournamentSetupEditable(tournament!, 'Tournaments can only be edited before they start');

  if (status !== undefined) {
    throw new BadRequestError('Tournament status is system-managed and cannot be set manually');
  }

  tournamentService.validateTournamentEnums({ sportType, format });
  assertSupportedTournamentFormat(format);

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ name });
    if (!sanitized.name) {
      throw new BadRequestError('Name cannot be empty or whitespace-only');
    }
    if (sanitized.name.length > MAX_NAME_LENGTH) {
      throw new BadRequestError(`Name must be at most ${MAX_NAME_LENGTH} characters`);
    }
    updateData.name = sanitized.name;
  }

  if (description !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ description });
    if (sanitized.description && sanitized.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new BadRequestError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    updateData.description = sanitized.description || null;
  }

  if (startDate !== undefined) {
    updateData.startDate = new Date(startDate);
  }

  if (endDate !== undefined) {
    updateData.endDate = endDate ? new Date(endDate) : null;
  }

  if (maxTeams !== undefined) {
    if (maxTeams > MAX_TEAMS_UPPER_BOUND) {
      throw new BadRequestError(`Max teams cannot exceed ${MAX_TEAMS_UPPER_BOUND}`);
    }
    if (maxTeams !== null) {
      const currentCount = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
      if (currentCount > maxTeams) {
        throw new BadRequestError(
          `Cannot reduce max teams to ${maxTeams}: ${currentCount} teams are already registered`
        );
      }
    }
    updateData.maxTeams = maxTeams;
  }
  if (sportType !== undefined) {
    updateData.sportType = sportType;
  }
  if (format !== undefined) {
    updateData.format = format;
  }

  if (location !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ location });
    updateData.location = sanitized.location || null;
  }

  if (locationName !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ locationName });
    updateData.locationName = sanitized.locationName || null;
  }

  if (city !== undefined) {
    if (city !== null && typeof city === 'string' && city.length > MAX_LOCATION_FIELD_LENGTH) {
      throw new BadRequestError(`City must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
    }
    updateData.city = city ? sanitizeString(city) : null;
  }
  if (country !== undefined) {
    if (country !== null && typeof country === 'string' && country.length > MAX_LOCATION_FIELD_LENGTH) {
      throw new BadRequestError(`Country must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
    }
    updateData.country = country ? sanitizeString(country) : null;
  }

  if (latitude !== undefined && longitude !== undefined) {
    const coords = parseCoordinates(latitude, longitude);
    updateData.latitude = coords.lat;
    updateData.longitude = coords.lon;
  }

  if (registrationDeadline !== undefined) {
    updateData.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null;
  }
  if (registrationStartDate !== undefined) {
    updateData.registrationStartDate = registrationStartDate ? new Date(registrationStartDate) : null;
  }
  if (isPublic !== undefined) {
    if (typeof isPublic !== 'boolean') {
      throw new BadRequestError('isPublic must be a boolean');
    }
    updateData.isPublic = isPublic;
  }
  if (allowLateRegistration !== undefined) {
    updateData.allowLateRegistration = allowLateRegistration;
  }
  if (autoGenerateBrackets !== undefined) {
    updateData.autoGenerateBrackets = autoGenerateBrackets;
  }
  if (useManualBrackets !== undefined) {
    updateData.useManualBrackets = useManualBrackets;
  }
  if (prizesDescription !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ prizesDescription });
    updateData.prizesDescription = sanitized.prizesDescription || null;
  }
  if (rulesDescription !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ rulesDescription });
    updateData.rulesDescription = sanitized.rulesDescription || null;
  }
  if (contactEmail !== undefined) {
    if (contactEmail) {
      if (!isValidEmail(contactEmail)) {
        throw new BadRequestError('Invalid contact email format');
      }
    }
    updateData.contactEmail = contactEmail || null;
  }
  if (sportConfig !== undefined) {
    validateSportConfigShape(sportConfig);
    updateData.sportConfig = sportConfig || null;
  }
  if (registrationFee !== undefined) {
    if (registrationFee === null) {
      updateData.registrationFee = null;
    } else {
      const fee = Number(registrationFee);
      if (isNaN(fee) || fee < 0) {
        throw new BadRequestError('registrationFee must be a non-negative number');
      }
      updateData.registrationFee = fee;
    }
  }
  if (requirePaymentForBrackets !== undefined) {
    if (typeof requirePaymentForBrackets !== 'boolean') {
      throw new BadRequestError('requirePaymentForBrackets must be a boolean');
    }
    updateData.requirePaymentForBrackets = requirePaymentForBrackets;
  }
  if (paymentInfo !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ paymentInfo });
    updateData.paymentInfo = sanitized.paymentInfo || null;
  }
  if (requireWaiverForRegistration !== undefined) {
    if (typeof requireWaiverForRegistration !== 'boolean') {
      throw new BadRequestError('requireWaiverForRegistration must be a boolean');
    }
    updateData.requireWaiverForRegistration = requireWaiverForRegistration;
  }
  if (waiverText !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ waiverText });
    updateData.waiverText = sanitized.waiverText || null;
  }
  if (rosterLockDate !== undefined) {
    updateData.rosterLockDate = parseOptionalDate(rosterLockDate, 'rosterLockDate');
  }
  if (paymentDeadline !== undefined) {
    updateData.paymentDeadline = parseOptionalDate(paymentDeadline, 'paymentDeadline');
  }
  if (tiebreakerRules !== undefined) {
    updateData.tiebreakerRules = validateTiebreakerRules(tiebreakerRules);
  }
  if (selfRefEnabled !== undefined) {
    if (typeof selfRefEnabled !== 'boolean') {
      throw new BadRequestError('selfRefEnabled must be a boolean');
    }
    updateData.selfRefEnabled = selfRefEnabled;
  }
  if (timezone !== undefined) {
    if (timezone === null || timezone === '') {
      updateData.timezone = null;
    } else {
      updateData.timezone = assertValidTournamentTimezone(timezone);
    }
  }
  if (noShowGraceMinutes !== undefined) {
    updateData.noShowGraceMinutes = parseNonNegativeInteger(noShowGraceMinutes, 'noShowGraceMinutes');
  }
  if (noShowAutoForfeit !== undefined) {
    updateData.noShowAutoForfeit = parseBoolean(noShowAutoForfeit, 'noShowAutoForfeit');
  }
  if (forfeitScoreFor !== undefined) {
    updateData.forfeitScoreFor = parseNonNegativeInteger(forfeitScoreFor, 'forfeitScoreFor');
  }
  if (forfeitScoreAgainst !== undefined) {
    updateData.forfeitScoreAgainst = parseNonNegativeInteger(forfeitScoreAgainst, 'forfeitScoreAgainst');
  }
  const nextForfeitScoreFor =
    (updateData.forfeitScoreFor as number | undefined) ?? tournament!.forfeitScoreFor ?? DEFAULT_FORFEIT_SCORE_FOR;
  const nextForfeitScoreAgainst =
    (updateData.forfeitScoreAgainst as number | undefined) ??
    tournament!.forfeitScoreAgainst ??
    DEFAULT_FORFEIT_SCORE_AGAINST;
  if (nextForfeitScoreFor <= nextForfeitScoreAgainst) {
    throw new BadRequestError('forfeitScoreFor must be greater than forfeitScoreAgainst');
  }
  if (minTeamRestMinutes !== undefined) {
    updateData.minTeamRestMinutes = parseIntegerInRange(
      minTeamRestMinutes,
      'minTeamRestMinutes',
      0,
      MAX_MIN_TEAM_REST_MINUTES
    );
  }
  if (withdrawalDeadline !== undefined) {
    if (withdrawalDeadline === null || withdrawalDeadline === '') {
      updateData.withdrawalDeadline = null;
    } else {
      const parsed = new Date(withdrawalDeadline);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestError('withdrawalDeadline must be a valid date');
      }
      updateData.withdrawalDeadline = parsed;
    }
  }
  if (autoPromoteRegistrationWaitlist !== undefined) {
    updateData.autoPromoteRegistrationWaitlist = parseBoolean(
      autoPromoteRegistrationWaitlist,
      'autoPromoteRegistrationWaitlist'
    );
  }
  if (rescheduleCutoffMinutes !== undefined) {
    updateData.rescheduleCutoffMinutes = parseNonNegativeInteger(rescheduleCutoffMinutes, 'rescheduleCutoffMinutes');
  }
  if (allowRescheduleAfterStart !== undefined) {
    updateData.allowRescheduleAfterStart = parseBoolean(allowRescheduleAfterStart, 'allowRescheduleAfterStart');
  }
  if (seedingPolicy !== undefined) {
    updateData.seedingPolicy = parseEnumInput(seedingPolicy, TOURNAMENT_SEEDING_POLICIES, 'seedingPolicy');
  }
  if (seedsLockedAt !== undefined) {
    if (seedsLockedAt === null || seedsLockedAt === '') {
      updateData.seedsLockedAt = null;
    } else {
      const parsed = new Date(seedsLockedAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestError('seedsLockedAt must be a valid date');
      }
      if (playoffSize !== undefined) {
        updateData.playoffSize = playoffSize === null ? null : parsePlayoffSize(playoffSize);
      }
      if (doubleElimination !== undefined) {
        updateData.doubleElimination = parseBoolean(doubleElimination, 'doubleElimination');
      }
      updateData.seedsLockedAt = parsed;
    }
  }
  if (enableThirdPlaceMatch !== undefined) {
    updateData.enableThirdPlaceMatch = parseBoolean(enableThirdPlaceMatch, 'enableThirdPlaceMatch');
  }
  if (enableConsolationBracket !== undefined) {
    updateData.enableConsolationBracket = parseBoolean(enableConsolationBracket, 'enableConsolationBracket');
  }
  if (allowByes !== undefined) {
    updateData.allowByes = parseBoolean(allowByes, 'allowByes');
  }
  if (contingencyMode !== undefined) {
    updateData.contingencyMode = parseEnumInput(contingencyMode, TOURNAMENT_CONTINGENCY_MODES, 'contingencyMode');
  }
  if (contingencyNotes !== undefined) {
    updateData.contingencyNotes =
      contingencyNotes === null || contingencyNotes === ''
        ? null
        : sanitizeString(String(contingencyNotes));
  }
  if (contingencyDelayMinutes !== undefined) {
    updateData.contingencyDelayMinutes = parseNonNegativeInteger(contingencyDelayMinutes, 'contingencyDelayMinutes');
  }

  tournamentService.validateTournamentBusinessRules({
    startDate: (updateData.startDate as Date | undefined) ?? tournament!.startDate,
    endDate:
      (updateData.endDate as Date | null | undefined) !== undefined
        ? (updateData.endDate as Date | null)
        : tournament!.endDate,
    registrationStartDate:
      (updateData.registrationStartDate as Date | null | undefined) !== undefined
        ? (updateData.registrationStartDate as Date | null)
        : tournament!.registrationStartDate,
    registrationDeadline:
      (updateData.registrationDeadline as Date | null | undefined) !== undefined
        ? (updateData.registrationDeadline as Date | null)
        : tournament!.registrationDeadline,
    maxTeams:
      (updateData.maxTeams as number | undefined) !== undefined
        ? (updateData.maxTeams as number)
        : tournament!.maxTeams,
  });

  const effectiveStartDate =
    ((updateData.startDate as Date | undefined) ?? tournament!.startDate);
  const effectivePaymentDeadline =
    (updateData.paymentDeadline as Date | null | undefined) !== undefined
      ? (updateData.paymentDeadline as Date | null)
      : tournament!.paymentDeadline;
  const effectiveRosterLockDate =
    (updateData.rosterLockDate as Date | null | undefined) !== undefined
      ? (updateData.rosterLockDate as Date | null)
      : tournament!.rosterLockDate;
  if (effectivePaymentDeadline && effectiveStartDate && effectivePaymentDeadline > effectiveStartDate) {
    throw new BadRequestError('paymentDeadline must be on or before startDate');
  }
  if (effectiveRosterLockDate && effectiveStartDate && effectiveRosterLockDate >= effectiveStartDate) {
    throw new BadRequestError('rosterLockDate must be before startDate');
  }

  const updatedTournament = await prisma.tournament.update({
    where: { id },
    data: updateData,
    include: {
      organizer: {
        select: { id: true, name: true, email: true }
      },
      group: {
        select: { id: true, name: true }
      }
    }
  });

  const syncedTournament = await tournamentService.syncTournamentAutoStatus(updatedTournament, 'update_tournament');

  logger.info('Tournament updated', 'TournamentController', {
    tournamentId: id,
    userId
  });

  res.json(syncedTournament);
};
