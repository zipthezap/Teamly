import { Request, Response } from 'express';

import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import { ForbiddenError } from '../../../utils/errors';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import * as tournamentService from '../../../services/tournamentService';

export const cloneTournament = async (req: Request, res: Response) => {
	const { id } = req.params;
	const userId = req.user!.id;

	const source = ensureResourceExists(
		await prisma.tournament.findUnique({
			where: { id },
			include: {
				categories: { orderBy: { sortOrder: 'asc' } },
				pools: {
					orderBy: { name: 'asc' },
					select: {
						name: true,
						description: true,
						maxTeams: true,
						venue: true,
						id: true,
						categoryId: true,
					},
				},
				registrationFields: { orderBy: { sortOrder: 'asc' } },
				courts: { where: { isActive: true }, orderBy: { name: 'asc' } },
			},
		}),
		'Tournament'
	);

	if (!await tournamentService.isOrganizerOrAdmin(source, userId)) {
		throw new ForbiddenError('Only the organizer or a co-organizer can clone the tournament');
	}

	const baseName = `${source.name} (Copy)`;
	const existingCopies = await prisma.tournament.count({
		where: { organizerId: userId, name: { startsWith: baseName } },
	});
	const cloneName = existingCopies == 0 ? baseName : `${baseName} ${existingCopies + 1}`;

	const cloned = await prisma.$transaction(async (tx) => {
		const newTournament = await tx.tournament.create({
			data: {
				name: cloneName,
				description: source.description ?? undefined,
				sportType: source.sportType,
				format: source.format,
				startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				endDate: undefined,
				maxTeams: source.maxTeams ?? undefined,
				location: source.location ?? undefined,
				latitude: source.latitude ?? undefined,
				longitude: source.longitude ?? undefined,
				locationName: source.locationName ?? undefined,
				city: source.city ?? undefined,
				country: source.country ?? undefined,
				organizerId: userId,
				groupId: source.groupId ?? undefined,
				isPublic: source.isPublic,
				allowLateRegistration: source.allowLateRegistration,
				autoGenerateBrackets: source.autoGenerateBrackets,
				useManualBrackets: source.useManualBrackets,
				prizesDescription: source.prizesDescription ?? undefined,
				rulesDescription: source.rulesDescription ?? undefined,
				contactEmail: source.contactEmail ?? undefined,
				sportConfig: source.sportConfig ?? undefined,
				registrationFee: source.registrationFee ?? undefined,
				requirePaymentForBrackets: source.requirePaymentForBrackets,
				paymentInfo: source.paymentInfo ?? undefined,
				requireWaiverForRegistration: source.requireWaiverForRegistration,
				waiverText: source.waiverText ?? undefined,
				tiebreakerRules: source.tiebreakerRules ?? undefined,
				selfRefEnabled: source.selfRefEnabled,
				timezone: source.timezone ?? undefined,
				noShowGraceMinutes: source.noShowGraceMinutes,
				noShowAutoForfeit: source.noShowAutoForfeit,
				forfeitScoreFor: source.forfeitScoreFor,
				forfeitScoreAgainst: source.forfeitScoreAgainst,
				minTeamRestMinutes: source.minTeamRestMinutes,
				withdrawalDeadline: source.withdrawalDeadline ?? undefined,
				autoPromoteRegistrationWaitlist: source.autoPromoteRegistrationWaitlist,
				rescheduleCutoffMinutes: source.rescheduleCutoffMinutes,
				allowRescheduleAfterStart: source.allowRescheduleAfterStart,
				seedingPolicy: source.seedingPolicy,
				seedsLockedAt: source.seedsLockedAt ?? undefined,
				enableThirdPlaceMatch: source.enableThirdPlaceMatch,
				enableConsolationBracket: source.enableConsolationBracket,
				allowByes: source.allowByes,
				contingencyMode: source.contingencyMode,
				contingencyNotes: source.contingencyNotes ?? undefined,
				contingencyDelayMinutes: source.contingencyDelayMinutes,
			},
			include: {
				organizer: { select: { id: true, name: true, email: true } },
			},
		});

		const newId = newTournament.id;

		const categoryIdMap = new Map<string, string>();
		for (const cat of source.categories) {
			const newCat = await tx.tournamentCategory.create({
				data: {
					tournamentId: newId,
					name: cat.name,
					description: cat.description ?? undefined,
					sortOrder: cat.sortOrder,
				},
			});
			categoryIdMap.set(cat.id, newCat.id);
		}

		for (const pool of source.pools) {
			await tx.tournamentPool.create({
				data: {
					tournamentId: newId,
					name: pool.name,
					description: pool.description ?? undefined,
					maxTeams: pool.maxTeams,
					venue: (pool as { venue?: string | null }).venue ?? undefined,
					categoryId: pool.categoryId
						? categoryIdMap.get(pool.categoryId) ?? undefined
						: undefined,
				},
			});
		}

		for (const field of source.registrationFields) {
			await tx.tournamentRegistrationField.create({
				data: {
					tournamentId: newId,
					label: field.label,
					fieldType: field.fieldType,
					isRequired: field.isRequired,
					options: field.options ?? [],
					sortOrder: field.sortOrder,
				},
			});
		}

		for (const court of source.courts) {
			await tx.tournamentCourt.create({
				data: {
					tournamentId: newId,
					name: court.name,
					location: court.location ?? undefined,
					isActive: true,
				},
			});
		}

		return newTournament;
	});

	logger.info('Tournament cloned', 'TournamentController', {
		sourceTournamentId: id,
		clonedTournamentId: cloned.id,
		userId,
		categoriesCopied: source.categories.length,
		poolsCopied: source.pools.length,
		registrationFieldsCopied: source.registrationFields.length,
		courtsCopied: source.courts.length,
	});

	res.status(201).json(cloned);
};
