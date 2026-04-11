import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/league_model.dart';
import '../state/leagues_notifier.dart';

class LeaguesPage extends ConsumerWidget {
  const LeaguesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaguesAsync = ref.watch(leaguesNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leagues'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.go('/leagues/create'),
          ),
        ],
      ),
      body: leaguesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
        data: (leagues) => leagues.isEmpty
            ? const Center(child: Text('No leagues found.'))
            : RefreshIndicator(
                onRefresh: () => ref.read(leaguesNotifierProvider.notifier).refresh(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: leagues.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final league = leagues[index];
                    return _LeagueCard(
                      league: league,
                      onTap: () => context.go('/leagues/${league.id}'),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

class _LeagueCard extends StatelessWidget {
  const _LeagueCard({required this.league, required this.onTap});

  final LeagueModel league;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundImage:
              league.coverImage != null ? NetworkImage(league.coverImage!) : null,
          child: league.coverImage == null
              ? Text(league.name[0].toUpperCase())
              : null,
        ),
        title: Text(league.name, style: theme.textTheme.titleMedium),
        subtitle: Text('${league.sport} · ${league.memberCount} members'),
        trailing: Icon(
          league.isPublic ? Icons.public : Icons.lock_outline,
          size: 18,
          color: theme.colorScheme.secondary,
        ),
      ),
    );
  }
}
