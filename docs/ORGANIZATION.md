# Documentation Organization

This document describes the documentation structure and organization for the Teamly project.

## Directory Structure

```
Teamly/
├── README.md                          # Main project documentation
├── docs/                              # Documentation directory
│   ├── API_DOCUMENTATION.md          # Detailed API reference
│   ├── DEPLOYMENT.md                 # Production deployment guide
│   ├── QUICK_START.md                # Quick setup instructions
│   ├── SECURITY.md                   # Security features and best practices
│   ├── architecture/                 # Architecture decisions and design
│   │   └── UUID_VS_INTEGER_IDS.md    # UUID vs Integer ID decision doc
│   ├── archive/                      # Historical documentation
│   │   ├── README.md                 # Archive index
│   │   └── [historical docs...]      # Old implementation summaries
│   ├── features/                     # Feature-specific documentation
│   │   └── ENHANCED_NOTIFICATIONS.md # Enhanced notification system
│   ├── guides/                       # User and developer guides
│   │   ├── AUTH_SECURITY_GUIDE.md    # Authentication & security
│   │   ├── FEATURES.md               # Core features guide
│   │   ├── FEATURE_ROADMAP.md        # Future features and ideas
│   │   ├── FRONTEND_GUIDE.md         # Frontend implementation
│   │   ├── SOCIAL_LOGIN_GUIDE.md     # Social authentication
│   │   ├── WINDOWS_SETUP.md          # Windows development setup
│   │   └── setup/                    # Setup guides
│   │       ├── GOOGLE_MAPS_SETUP.md  # Google Maps integration
│   │       └── TRANSLATIONS.md       # Translation system
│   └── examples/                     # Code examples
└── scripts/                          # Scripts directory
    ├── README.md                     # Scripts documentation
    ├── tests/                        # Test scripts
    │   ├── test-api.sh              # Main API tests
    │   ├── test-api.bat             # Windows version
    │   └── [other test scripts...]  # Feature-specific tests
    └── [maintenance scripts...]      # Maintenance and utility scripts
```

## Documentation Categories

### Core Documentation (`docs/`)

Essential documentation for understanding and using the project:
- **API_DOCUMENTATION.md** - Complete API reference with endpoints, parameters, and examples
- **BACKEND_IMPROVEMENTS.md** - Backend architecture and performance improvements
- **DEPLOYMENT.md** - Deployment instructions for various environments
- **LOCATION_API.md** - Location services and mapping integration
- **OAUTH_SETUP.md** - OAuth authentication setup instructions
- **PERMISSIONS.md** - Authorization and permissions system
- **QUICK_START.md** - Quick setup guide for getting started fast
- **SCALABILITY.md** - Scalability architecture overview
- **SCALABILITY_IMPROVEMENTS.md** - Detailed scalability enhancements
- **SECURITY.md** - Security features, best practices, and configuration
- **TOURNAMENT_API.md** - Tournament system API reference

### Architecture (`docs/architecture/`)

Architecture decisions and design documentation:
- **UUID_VS_INTEGER_IDS.md** - UUID vs Integer ID architecture decision and rationale
- **DATABASE_ID_QUICK_REFERENCE.md** - Quick reference guide for working with UUIDs

### Features (`docs/features/`)

Documentation for specific features:
- **ENHANCED_NOTIFICATIONS.md** - Enhanced notification system with real-time updates and filtering
- **EVENT_EXPORT.md** - Event data export functionality (CSV, iCal, JSON)
- **TEAMUP_IMPROVEMENTS.md** - TeamUp feature improvements
- **TEAMUP_NOTIFICATIONS.md** - TeamUp notification system

### Guides (`docs/guides/`)

User and developer guides organized by topic:

#### User Guides
- **FEATURES.md** - Complete guide to all features
- **TOURNAMENT_USER_GUIDE.md** - How to use tournament features
- **USER_GUIDE_MANUAL_BRACKETS.md** - Manual bracket management guide
- **MANUAL_BRACKET_MANAGEMENT.md** - Advanced bracket management

#### Setup Guides
- **WINDOWS_SETUP.md** - Comprehensive Windows development setup
- **SOCIAL_LOGIN_GUIDE.md** - Social authentication setup
- **PICTURE_UPLOAD.md** - Picture upload feature setup
- **GROUP_PICTURE_UPLOAD.md** - Group picture upload guide
- **TOURNAMENT_PLAYER_REGISTRATION.md** - Tournament player registration
- **setup/** - Additional setup guides (Google Maps, Translations)

#### Developer Guides
- **FRONTEND_GUIDE.md** - Frontend development guide
- **ERROR_HANDLING_GUIDE.md** - Error handling best practices
- **AUTH_SECURITY_GUIDE.md** - Authentication and security guide
- **MIGRATION_GUIDE.md** - Migration guides for upgrades
- **MIGRATION_TO_IOS.md** - iOS migration guide
- **FEATURE_ROADMAP.md** - Future features and roadmap

### Examples (`docs/examples/`)

Code examples and usage patterns:
- **CONTROLLER_MIGRATION_EXAMPLE.ts** - Controller migration example
- **EXAMPLE_USAGE.tsx** - React component usage examples

### Archive (`docs/archive/`)

Historical documentation preserved for reference, including:
- Implementation summaries from all feature development phases
- Security analysis and improvement reports
- Scalability implementation documentation
- Tournament, guest management, and OAuth implementation reports
- Backend improvements and refactoring summaries
- Historical bug fixes and quick references

All archived documentation is organized and catalogued in [docs/archive/README.md](archive/README.md) for easy reference.

## Scripts Organization

### Test Scripts (`scripts/tests/`)

All test scripts have been moved to `scripts/tests/` for better organization:
- Run with: `./scripts/tests/test-api.sh` (Unix) or `scripts\tests\test-api.bat` (Windows)
- See [scripts/README.md](../scripts/README.md) for full documentation

### Maintenance Scripts (`scripts/`)

Maintenance and utility scripts in the root scripts directory:
- Event maintenance and cleanup
- Scheduled tasks and reminders
- Backend testing and validation

## Navigation Tips

### From Root Directory
- Start with `README.md` for project overview
- Check `docs/QUICK_START.md` to get running quickly
- Browse `docs/guides/` for specific topics

### From Documentation
- Core docs use relative paths: `../API_DOCUMENTATION.md`
- Guides use relative paths: `../DEPLOYMENT.md` or `setup/GOOGLE_MAPS_SETUP.md`
- Main README: `../../README.md`

### Finding Documentation
1. **For API usage**: `docs/API_DOCUMENTATION.md`
2. **For deployment**: `docs/DEPLOYMENT.md`
3. **For features**: `docs/guides/FEATURES.md`
4. **For setup help**: `docs/guides/WINDOWS_SETUP.md` or `docs/guides/setup/`
5. **For security**: `docs/SECURITY.md`
6. **For architecture decisions**: `docs/architecture/UUID_VS_INTEGER_IDS.md`

## Benefits of This Organization

1. **Cleaner Root**: Only essential files in root directory
2. **Logical Grouping**: Related docs together by category
3. **Easy Navigation**: Clear hierarchy and consistent paths
4. **Historical Preservation**: Old docs archived but accessible
5. **Better Discoverability**: Organized structure makes finding docs easier
6. **Scalability**: Easy to add new docs in appropriate categories

## Maintenance

When adding new documentation:
1. Place it in the appropriate directory based on type
2. Update this organization guide if adding new categories
3. Ensure cross-references use relative paths
4. Update the main README if it's core documentation
5. Add to archive if deprecating old documentation
