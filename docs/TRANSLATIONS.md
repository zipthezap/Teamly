# Translation Guide

Teamly supports multiple languages using i18next and react-i18next. Currently supported languages:
- English (en)
- French (fr)

## Project Structure

Translation files are located in:
```
src/frontend/src/locales/
├── en/
│   └── translation.json
└── fr/
    └── translation.json
```

## Using Translations in Components

### 1. Import the hook
```typescript
import { useTranslation } from 'react-i18next';
```

### 2. Use translations in your component
```typescript
const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('common.dashboard')}</h1>
      <p>{t('dashboard.welcomeBack', { name: 'John' })}</p>
    </div>
  );
};
```

## Translation Keys Structure

The translation files are organized hierarchically:

```json
{
  "common": {
    "dashboard": "Dashboard",
    "groups": "Groups",
    ...
  },
  "auth": {
    "loginTitle": "Sign in to Teamly",
    ...
  },
  "events": {
    "createEvent": "Create Event",
    "types": {
      "football": "Football",
      ...
    }
  }
}
```

### Key Naming Conventions

1. **Nested structure**: Group related translations under common parent keys
2. **camelCase**: Use camelCase for key names (e.g., `createEvent`, `welcomeBack`)
3. **Descriptive**: Keys should describe the content, not the location
4. **Consistent**: Use consistent naming patterns across the application

### Interpolation

Use double curly braces for variables:

```json
{
  "welcomeBack": "Welcome back, {{name}}! 👋",
  "participantsCount": "{{count}} / {{max}} participants"
}
```

Usage:
```typescript
t('dashboard.welcomeBack', { name: userName })
t('eventDetails.participantsCount', { count: 5, max: 10 })
```

### Pluralization

i18next supports pluralization with `_plural` suffix:

```json
{
  "groupsFound": "{{count}} group found",
  "groupsFound_plural": "{{count}} groups found"
}
```

Usage:
```typescript
t('groups.groupsFound', { count: 1 })  // "1 group found"
t('groups.groupsFound', { count: 5 })  // "5 groups found"
```

## Adding a New Language

1. Create a new directory in `src/frontend/src/locales/` (e.g., `es/` for Spanish)
2. Create a `translation.json` file with the same structure as English
3. Update `src/frontend/src/i18n.ts`:

```typescript
import esTranslation from './locales/es/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      fr: { translation: frTranslation },
      es: { translation: esTranslation }, // Add new language
    },
    // ...
  });
```

4. Update the LanguageSwitcher component to include the new language

## Adding Translations to a Component

### Step 1: Import the hook
```typescript
import { useTranslation } from 'react-i18next';
```

### Step 2: Extract translatable strings
Identify all hardcoded strings that should be translated:
- UI labels
- Button text
- Messages
- Error messages
- Placeholders
- Helper text

### Step 3: Add translation keys
Add the keys to both `en/translation.json` and `fr/translation.json`:

```json
// en/translation.json
{
  "myComponent": {
    "title": "My Component",
    "submitButton": "Submit",
    "cancelButton": "Cancel"
  }
}

// fr/translation.json
{
  "myComponent": {
    "title": "Mon Composant",
    "submitButton": "Soumettre",
    "cancelButton": "Annuler"
  }
}
```

### Step 4: Replace strings with translation calls
```typescript
const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
      <button>{t('myComponent.submitButton')}</button>
      <button>{t('myComponent.cancelButton')}</button>
    </div>
  );
};
```

## Language Switching

Users can switch languages using the LanguageSwitcher component in the navbar. The selected language is stored in localStorage and persists across sessions.

## Common Translation Sections

- **common**: Shared UI elements (buttons, labels, status messages)
- **auth**: Authentication (login, register, password)
- **navbar**: Navigation bar items
- **dashboard**: Dashboard-specific text
- **events**: Event-related translations
- **groups**: Group-related translations
- **profile**: User profile settings
- **locationPicker**: Location picker component
- **eventDetails**: Event details page
- **groupDetails**: Group details page

## Best Practices

1. **Always add both languages**: When adding new keys, update both English and French files
2. **Keep translations up to date**: Don't leave TODO or placeholder translations
3. **Use meaningful keys**: Keys should describe the content, not the location
4. **Group related keys**: Use nested objects to organize related translations
5. **Test both languages**: Verify translations work correctly in both languages
6. **Handle plurals correctly**: Use i18next pluralization features
7. **Extract all strings**: Don't leave hardcoded text in components
8. **Consider context**: Some words translate differently based on context

## Maintenance

### Checking for missing translations
Compare the structure of translation files to ensure all keys exist in both languages.

### Finding untranslated strings
Search for hardcoded strings in components:
```bash
# Find potential hardcoded strings
grep -r "\"[A-Z]" src/frontend/src/pages/
grep -r "\"[A-Z]" src/frontend/src/components/
```

### Validating JSON structure
```bash
# Validate translation files
python3 -m json.tool src/frontend/src/locales/en/translation.json
python3 -m json.tool src/frontend/src/locales/fr/translation.json
```

## Example Components

### LocationPicker
Shows comprehensive translation usage including:
- Labels with translations
- Placeholders with translations
- Helper text with translations
- Button text with translations
- Error messages with interpolation

### PublicGroups
Demonstrates:
- Complex nested translation keys
- Interpolation with multiple variables
- Status messages
- Pluralization

## Troubleshooting

### Translation key not found
- Check the key path is correct
- Verify the key exists in translation files
- Ensure `useTranslation()` hook is called
- Check for typos in key names

### Translations not updating
- Clear browser cache
- Restart development server
- Check localStorage for cached language setting

### Interpolation not working
- Ensure variable names match between translation and code
- Check for proper syntax: `{{variableName}}`
- Verify you're passing the variables in the second parameter: `t('key', { variable: value })`
