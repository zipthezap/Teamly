import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/leagues_notifier.dart';

class LeagueDetailPage extends ConsumerWidget {
  const LeagueDetailPage({super.key, required this.leagueId});

  final String leagueId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leagueAsync = ref.watch(leagueDetailProvider(leagueId));

    return Scaffold(
      appBar: AppBar(
        title: leagueAsync.maybeWhen(
          data: (l) => Text(l.name),
          orElse: () => const Text('League'),
        ),
      ),
      body: leagueAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
        data: (league) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (league.coverImage != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  league.coverImage!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            const SizedBox(height: 16),
            Text(league.name, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text('Sport: ${league.sport}'),
            Text('Members: ${league.memberCount}'),
            if (league.location != null) Text('Location: ${league.location}'),
            if (league.description != null) ...[
              const SizedBox(height: 12),
              Text(league.description!),
            ],
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () =>
                  ref.read(leaguesNotifierProvider.notifier).joinLeague(leagueId),
              icon: const Icon(Icons.group_add),
              label: const Text('Join League'),
            ),
          ],
        ),
      ),
    );
  }
}
