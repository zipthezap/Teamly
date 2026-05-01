import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';


class CreateTournamentPage extends ConsumerStatefulWidget {
  const CreateTournamentPage({super.key});

  @override
  ConsumerState<CreateTournamentPage> createState() => _CreateTournamentPageState();
}

class _CreateTournamentPageState extends ConsumerState<CreateTournamentPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _maxTeamsCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _rulesCtrl = TextEditingController();
  final _prizesCtrl = TextEditingController();

  String _sportType = '';
  String _format = 'single_elimination';
  DateTime? _startDate;
  DateTime? _endDate;
  DateTime? _registrationStartDate;
  DateTime? _registrationDeadline;
  bool _useManualBrackets = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _maxTeamsCtrl.dispose();
    _locationCtrl.dispose();
    _rulesCtrl.dispose();
    _prizesCtrl.dispose();
    super.dispose();
  }

  Future<DateTime?> _pickDate(DateTime? initial, {DateTime? firstDate}) async {
    return showDatePicker(
      context: context,
      initialDate: initial ?? (firstDate ?? DateTime.now()).add(const Duration(days: 7)),
      firstDate: firstDate ?? DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    if (_startDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a tournament start date')),
      );
      setState(() => _saving = false);
      return;
    }
    // Validate date ordering
    if (_endDate != null && !_endDate!.isAfter(_startDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tournament end date must be after the start date')),
      );
      setState(() => _saving = false);
      return;
    }
    if (_registrationDeadline != null && !_startDate!.isAfter(_registrationDeadline!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration deadline must be before the tournament start date')),
      );
      setState(() => _saving = false);
      return;
    }
    if (_registrationStartDate != null && _registrationDeadline != null &&
        !_registrationDeadline!.isAfter(_registrationStartDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration deadline must be after the registration open date')),
      );
      setState(() => _saving = false);
      return;
    }
    try {
      final tournament = await ref.read(tournamentRepositoryProvider).createTournament({
        'name': _nameCtrl.text.trim(),
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        'format': _format,
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        if (_maxTeamsCtrl.text.trim().isNotEmpty) 'maxTeams': int.tryParse(_maxTeamsCtrl.text.trim()),
        if (_startDate != null) 'startDate': _startDate!.toIso8601String(),
        if (_endDate != null) 'endDate': _endDate!.toIso8601String(),
        if (_registrationStartDate != null) 'registrationStartDate': _registrationStartDate!.toIso8601String(),
        if (_registrationDeadline != null) 'registrationDeadline': _registrationDeadline!.toIso8601String(),
        if (_locationCtrl.text.trim().isNotEmpty) 'location': _locationCtrl.text.trim(),
        if (_rulesCtrl.text.trim().isNotEmpty) 'rulesDescription': _rulesCtrl.text.trim(),
        if (_prizesCtrl.text.trim().isNotEmpty) 'prizesDescription': _prizesCtrl.text.trim(),
        'useManualBrackets': _useManualBrackets,
      });
      ref.read(tournamentsNotifierProvider.notifier).reload();
      if (!mounted) return;

      // Prompt to set up pools/categories immediately after creation
      final setup = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Tournament Created! 🎉'),
          content: const Text('Would you like to set up pools or categories now to organise your teams?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, 'skip'), child: const Text('Skip')),
            OutlinedButton(onPressed: () => Navigator.pop(ctx, 'categories'), child: const Text('Categories')),
            FilledButton(onPressed: () => Navigator.pop(ctx, 'pools'), child: const Text('Pools')),
          ],
        ),
      );
      if (!mounted) return;
      if (setup == 'pools') {
        context.go('/tournaments/${tournament.id}/pools');
      } else if (setup == 'categories') {
        context.go('/tournaments/${tournament.id}/categories');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tournament created!')));
        context.go('/tournaments/${tournament.id}');
      }
    } on Exception catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(error)), backgroundColor: Theme.of(context).colorScheme.error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _dateTile({required String label, required DateTime? value, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, prefixIcon: const Icon(Icons.calendar_today_outlined)),
        child: Text(
          value != null ? DateFormat.yMMMd().format(value) : 'Tap to select',
          style: TextStyle(color: value == null ? AppThemeTokens.textSecondary(context) : AppThemeTokens.text(context), fontSize: 14),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Tournament')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            UiSectionTitle('Basic Info'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Tournament name *', prefixIcon: Icon(Icons.emoji_events_outlined)),
              textCapitalization: TextCapitalization.words,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _sportType.isNotEmpty ? _sportType : null,
              decoration: const InputDecoration(labelText: 'Sport type *', prefixIcon: Icon(Icons.sports_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: kSportTypes.where((s) => s['value']!.isNotEmpty).map((s) => DropdownMenuItem(value: s['value'], child: Text(s['label']!))).toList(),
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              onChanged: (v) => setState(() => _sportType = v ?? ''),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _format,
              decoration: const InputDecoration(labelText: 'Format *', prefixIcon: Icon(Icons.account_tree_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: const [
                DropdownMenuItem(value: 'single_elimination', child: Text('Single Elimination')),
                DropdownMenuItem(value: 'round_robin', child: Text('Round Robin')),
                DropdownMenuItem(value: 'groups_knockout', child: Text('Groups + Knockout')),
              ],
              onChanged: (v) => setState(() => _format = v ?? 'single_elimination'),
            ),
            const SizedBox(height: 16),
            TextFormField(controller: _descCtrl, decoration: const InputDecoration(labelText: 'Description', prefixIcon: Icon(Icons.notes_outlined), alignLabelWithHint: true), maxLines: 3),
            const SizedBox(height: 16),
            TextFormField(controller: _maxTeamsCtrl, decoration: const InputDecoration(labelText: 'Max teams', prefixIcon: Icon(Icons.group_outlined)), keyboardType: TextInputType.number,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                final n = int.tryParse(v.trim());
                if (n == null) return 'Must be a number';
                if (n < 2) return 'At least 2 teams required';
                if (n > 1000) return 'Max 1,000 teams';
                return null;
              }),
            const SizedBox(height: 24),
            UiSectionTitle('Dates'),
            const SizedBox(height: 8),
            _dateTile(label: 'Registration opens', value: _registrationStartDate, onTap: () async { final d = await _pickDate(_registrationStartDate); if (d != null) setState(() => _registrationStartDate = d); }),
            const SizedBox(height: 12),
            _dateTile(label: 'Registration deadline', value: _registrationDeadline, onTap: () async { final d = await _pickDate(_registrationDeadline); if (d != null) setState(() => _registrationDeadline = d); }),
            const SizedBox(height: 12),
            _dateTile(label: 'Tournament start *', value: _startDate, onTap: () async { final d = await _pickDate(_startDate); if (d != null) setState(() => _startDate = d); }),
            if (_startDate == null && _saving)
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 12),
                child: Text('Please select a start date', style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
              ),
            const SizedBox(height: 12),
            _dateTile(label: 'Tournament end', value: _endDate, onTap: () async { final d = await _pickDate(_endDate, firstDate: _startDate); if (d != null) setState(() => _endDate = d); }),
            const SizedBox(height: 24),
            UiSectionTitle('Location'),
            const SizedBox(height: 8),
            TextFormField(controller: _locationCtrl, decoration: const InputDecoration(labelText: 'Location / Venue', prefixIcon: Icon(Icons.location_on_outlined))),
            const SizedBox(height: 24),
            UiSectionTitle('Additional Info'),
            const SizedBox(height: 8),
            TextFormField(controller: _rulesCtrl, decoration: const InputDecoration(labelText: 'Rules', prefixIcon: Icon(Icons.rule_outlined), alignLabelWithHint: true), maxLines: 4),
            const SizedBox(height: 16),
            TextFormField(controller: _prizesCtrl, decoration: const InputDecoration(labelText: 'Prizes', prefixIcon: Icon(Icons.card_giftcard_outlined), alignLabelWithHint: true), maxLines: 3),
            const SizedBox(height: 24),
            UiSectionTitle('Settings'),
            SwitchListTile(
              title: const Text('Manual pool/bracket management'),
              subtitle: const Text('Manually create pools and assign teams instead of auto-generating'),
              value: _useManualBrackets,
              onChanged: (v) => setState(() => _useManualBrackets = v),
            ),
            const SizedBox(height: 28),
            UiPrimaryButton(text: 'Create Tournament', icon: Icons.add_circle_outline, onPressed: _saving ? null : _submit, loading: _saving),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Pools Management Page
// ===========================================================================

