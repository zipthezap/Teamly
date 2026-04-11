import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/models/league_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../features/groups/state/groups_notifier.dart';
import '../data/league_repository_impl.dart';
import '../state/leagues_notifier.dart';

// Sport options matching backend SportType enum
const _kSports = [
  'football', 'basketball', 'tennis', 'volleyball', 'running',
  'cycling', 'swimming', 'cricket', 'americanFootball', 'iceHockey',
  'baseball', 'rugby', 'handball', 'fieldHockey', 'other',
];

String _sportLabel(String s) {
  const m = {
    'football': 'Football',
    'basketball': 'Basketball',
    'tennis': 'Tennis',
    'volleyball': 'Volleyball',
    'running': 'Running',
    'cycling': 'Cycling',
    'swimming': 'Swimming',
    'cricket': 'Cricket',
    'americanFootball': 'American Football',
    'iceHockey': 'Ice Hockey',
    'baseball': 'Baseball',
    'rugby': 'Rugby',
    'handball': 'Handball',
    'fieldHockey': 'Field Hockey',
    'other': 'Other',
  };
  return m[s] ?? s;
}

class CreateLeaguePage extends ConsumerStatefulWidget {
  const CreateLeaguePage({super.key});

  @override
  ConsumerState<CreateLeaguePage> createState() => _CreateLeaguePageState();
}

class _CreateLeaguePageState extends ConsumerState<CreateLeaguePage> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _sessionCountCtrl = TextEditingController();
  final _maxTeamsCtrl = TextEditingController();

  String _sport = 'football';
  bool _isPublic = true;
  bool _isSubmitting = false;
  LeagueScheduleType _scheduleType = LeagueScheduleType.sessions;
  DateTime _startDate = DateTime.now();
  DateTime? _endDate;
  String? _groupId;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _sessionCountCtrl.dispose();
    _maxTeamsCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isEnd}) async {
    final initial = isEnd ? (_endDate ?? _startDate.add(const Duration(days: 30))) : _startDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: isEnd ? _startDate : DateTime(2020),
      lastDate: DateTime(2040),
    );
    if (picked == null) return;
    setState(() {
      if (isEnd) {
        _endDate = picked;
      } else {
        _startDate = picked;
        if (_endDate != null && _endDate!.isBefore(_startDate)) {
          _endDate = null;
        }
      }
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_groupId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a group')),
      );
      return;
    }
    if (_scheduleType == LeagueScheduleType.duration && _endDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please set an end date for duration leagues')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final repo = ref.read(leagueRepositoryProvider);
      await repo.createLeague(
        title: _titleCtrl.text.trim(),
        sport: _sport,
        isPublic: _isPublic,
        groupId: _groupId!,
        startDate: _startDate,
        scheduleType: _scheduleType,
        description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        location: _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
        sessionCount: _scheduleType == LeagueScheduleType.sessions
            ? int.tryParse(_sessionCountCtrl.text.trim())
            : null,
        maxTeams: _maxTeamsCtrl.text.trim().isEmpty
            ? null
            : int.tryParse(_maxTeamsCtrl.text.trim()),
        endDate: _scheduleType == LeagueScheduleType.duration ? _endDate : null,
      );
      await ref.read(leaguesNotifierProvider.notifier).refresh();
      if (mounted) context.go('/leagues');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create league: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupsNotifierProvider);
    final fmt = DateFormat('d MMM yyyy');

    return Scaffold(
      appBar: AppBar(title: const Text('Create League')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Basic info ──────────────────────────────────────────────────
            const UiSectionTitle(title: 'Basic Info'),
            const SizedBox(height: 10),

            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(
                labelText: 'League Name *',
                prefixIcon: Icon(Icons.military_tech_outlined),
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Name is required' : null,
            ),
            const SizedBox(height: 12),

            // Sport picker
            DropdownButtonFormField<String>(
              value: _sport,
              decoration: const InputDecoration(
                labelText: 'Sport *',
                prefixIcon: Icon(Icons.sports_soccer_outlined),
              ),
              items: _kSports
                  .map((s) => DropdownMenuItem(
                      value: s, child: Text(_sportLabel(s))))
                  .toList(),
              onChanged: (v) => setState(() => _sport = v ?? _sport),
            ),
            const SizedBox(height: 12),

            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description',
                prefixIcon: Icon(Icons.notes_outlined),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 12),

            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(
                labelText: 'Location',
                prefixIcon: Icon(Icons.location_on_outlined),
              ),
            ),
            const SizedBox(height: 12),

            // Group picker
            groupsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const SizedBox.shrink(),
              data: (groups) => DropdownButtonFormField<String>(
                value: _groupId,
                decoration: const InputDecoration(
                  labelText: 'Group *',
                  prefixIcon: Icon(Icons.groups_outlined),
                ),
                hint: const Text('Select a group'),
                items: groups
                    .map((g) =>
                        DropdownMenuItem(value: g.id, child: Text(g.name)))
                    .toList(),
                onChanged: (v) => setState(() => _groupId = v),
              ),
            ),
            const SizedBox(height: 12),

            TextFormField(
              controller: _maxTeamsCtrl,
              decoration: const InputDecoration(
                labelText: 'Max Teams',
                prefixIcon: Icon(Icons.group_work_outlined),
                hintText: 'Optional',
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            ),
            const SizedBox(height: 12),

            SwitchListTile(
              title: const Text('Public League'),
              subtitle: const Text('Anyone can find and join this league'),
              value: _isPublic,
              onChanged: (v) => setState(() => _isPublic = v),
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 20),

            // ── Schedule type ───────────────────────────────────────────────
            const UiSectionTitle(title: 'Schedule'),
            const SizedBox(height: 10),

            // Toggle: Sessions vs Duration
            Row(
              children: [
                Expanded(
                  child: _ScheduleTypeButton(
                    label: 'Session Count',
                    icon: Icons.format_list_numbered,
                    selected:
                        _scheduleType == LeagueScheduleType.sessions,
                    onTap: () => setState(
                        () => _scheduleType = LeagueScheduleType.sessions),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ScheduleTypeButton(
                    label: 'Time Duration',
                    icon: Icons.calendar_month_outlined,
                    selected:
                        _scheduleType == LeagueScheduleType.duration,
                    onTap: () => setState(
                        () => _scheduleType = LeagueScheduleType.duration),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Session count field (only for sessions schedule)
            if (_scheduleType == LeagueScheduleType.sessions)
              TextFormField(
                controller: _sessionCountCtrl,
                decoration: const InputDecoration(
                  labelText: 'Number of Sessions *',
                  prefixIcon: Icon(Icons.tag),
                  hintText: 'e.g. 10',
                ),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (v) {
                  if (_scheduleType != LeagueScheduleType.sessions) return null;
                  if (v == null || v.trim().isEmpty) return 'Required for session leagues';
                  if ((int.tryParse(v.trim()) ?? 0) < 1) return 'Must be at least 1';
                  return null;
                },
              ),

            // Start date picker
            _DateTile(
              label: 'Start Date *',
              date: _startDate,
              onTap: () => _pickDate(isEnd: false),
              fmt: fmt,
            ),
            const SizedBox(height: 10),

            // End date (required for duration, optional otherwise)
            _DateTile(
              label: _scheduleType == LeagueScheduleType.duration
                  ? 'End Date *'
                  : 'End Date (optional)',
              date: _endDate,
              onTap: () => _pickDate(isEnd: true),
              fmt: fmt,
            ),

            const SizedBox(height: 28),

            UiPrimaryButton(
              text: 'Create League',
              loading: _isSubmitting,
              onPressed: _isSubmitting ? null : _submit,
              icon: Icons.military_tech_outlined,
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _ScheduleTypeButton extends StatelessWidget {
  const _ScheduleTypeButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppThemeTokens.primary500 : AppThemeTokens.darkTextSecondary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: selected
              ? AppThemeTokens.primaryGlow
              : AppThemeTokens.darkCard.withValues(alpha: 0.5),
          border: Border.all(
            color: selected ? AppThemeTokens.primary500 : AppThemeTokens.darkBorder,
          ),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DateTile extends StatelessWidget {
  const _DateTile({
    required this.label,
    required this.date,
    required this.onTap,
    required this.fmt,
  });

  final String label;
  final DateTime? date;
  final VoidCallback onTap;
  final DateFormat fmt;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.calendar_today_outlined, size: 20),
      title: Text(label,
          style: TextStyle(fontSize: 13, color: textSecondary, fontFamily: 'Inter')),
      trailing: Text(
        date != null ? fmt.format(date!) : 'Tap to select',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: date != null
              ? AppThemeTokens.primary400
              : textSecondary,
        ),
      ),
      onTap: onTap,
    );
  }
}
