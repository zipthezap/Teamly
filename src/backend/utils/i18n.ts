export type Locale = 'en' | 'fr';

export interface I18n {
  t: (key: string, params?: Record<string, any>, lang?: Locale) => string;
}

const translations: Record<string, Record<string, string>> = {
  en: {
    newEvent: "New Event: {{eventTitle}}",
    reminder: "Reminder: {{eventTitle}}",
    activityJoin: "{{name}} joined your event",
    activityLeave: "{{name}} left your event",
    activityLate: "{{name}} will be late",
    activityConfirmed: "{{name}} confirmed attendance",
    activityDeclined: "{{name}} declined",
    eventUpdate: "Event Update: {{eventTitle}}",
    newJoinRequest: "New Join Request",
    joinRequestAccepted: "Join Request Accepted",
    newGroupNearYou: "New Group Near You",
    groupUpdate: "Group Update: {{groupName}}",
    eventCreated: "A new event has been created. Check it out!",
    reminderMessage: "Don't forget to attend!",
    activityJoinMessage: "{{name}} has joined \"{{eventTitle}}\"",
    activityLeaveMessage: "{{name}} has left \"{{eventTitle}}\"",
    activityLateMessage: "{{name}} marked themselves as late for \"{{eventTitle}}\"",
    activityConfirmedMessage: "{{name}} confirmed attendance for \"{{eventTitle}}\"",
    activityDeclinedMessage: "{{name}} declined \"{{eventTitle}}\"",
    eventUpdateMessage: "There's an update to \"{{eventTitle}}\"",
    joinRequestMessage: "Someone wants to join \"{{groupName}}\"",
    joinAcceptedMessage: "Welcome to \"{{groupName}}\"! Your join request was accepted.",
    newGroupCreatedMessage: "New group \"{{groupName}}\" created near you",
    groupUpdateMessage: "There's an update to \"{{groupName}}\"",
    teamupResponse: "{{name}} applied to your TeamUp request",
    teamupAccepted: "Your response to \"{{title}}\" was accepted",
    teamupDeclined: "Your response to \"{{title}}\" was declined",
    teamupResponseMessage: "{{name}} applied to your TeamUp request \"{{title}}\"",
    teamupAcceptedMessage: "Great news! Your response to \"{{title}}\" was accepted. Get ready for {{sportType}}!",
    teamupDeclinedMessage: "Your response to \"{{title}}\" was not accepted. Keep looking for other opportunities!",
    someone: "Someone",
    event: "event",
    group: "group"
  },
  fr: {
    newEvent: "Nouvel événement : {{eventTitle}}",
    reminder: "Rappel : {{eventTitle}}",
    activityJoin: "{{name}} a rejoint votre événement",
    activityLeave: "{{name}} a quitté votre événement",
    activityLate: "{{name}} sera en retard",
    activityConfirmed: "{{name}} a confirmé sa présence",
    activityDeclined: "{{name}} a refusé",
    eventUpdate: "Mise à jour de l'événement : {{eventTitle}}",
    newJoinRequest: "Nouvelle demande d'adhésion",
    joinRequestAccepted: "Demande d'adhésion acceptée",
    newGroupNearYou: "Nouveau groupe près de chez vous",
    groupUpdate: "Mise à jour du groupe : {{groupName}}",
    eventCreated: "Un nouvel événement a été créé. Découvrez-le !",
    reminderMessage: "N'oubliez pas d'y assister !",
    activityJoinMessage: "{{name}} a rejoint \"{{eventTitle}}\"",
    activityLeaveMessage: "{{name}} a quitté \"{{eventTitle}}\"",
    activityLateMessage: "{{name}} s'est signalé en retard pour \"{{eventTitle}}\"",
    activityConfirmedMessage: "{{name}} a confirmé sa présence pour \"{{eventTitle}}\"",
    activityDeclinedMessage: "{{name}} a refusé \"{{eventTitle}}\"",
    eventUpdateMessage: "Il y a une mise à jour pour \"{{eventTitle}}\"",
    joinRequestMessage: "Quelqu'un souhaite rejoindre \"{{groupName}}\"",
    joinAcceptedMessage: "Bienvenue dans \"{{groupName}}\" ! Votre demande d'adhésion a été acceptée.",
    newGroupCreatedMessage: "Nouveau groupe \"{{groupName}}\" créé près de chez vous",
    groupUpdateMessage: "Il y a une mise à jour pour \"{{groupName}}\"",
    teamupResponse: "{{name}} a postulé à votre demande TeamUp",
    teamupAccepted: "Votre réponse à \"{{title}}\" a été acceptée",
    teamupDeclined: "Votre réponse à \"{{title}}\" n'a pas été acceptée",
    teamupResponseMessage: "{{name}} a postulé à votre demande TeamUp \"{{title}}\"",
    teamupAcceptedMessage: "Bonne nouvelle ! Votre réponse à \"{{title}}\" a été acceptée. Préparez-vous pour {{sportType}} !",
    teamupDeclinedMessage: "Votre réponse à \"{{title}}\" n'a pas été acceptée. Continuez à chercher d'autres opportunités !",
    someone: "Quelqu'un",
    event: "événement",
    group: "groupe"
  }
};

function interpolate(str: string, params: Record<string, string | number> = {}) {
  return str.replace(/{{(\w+)}}/g, (_, k) => params[k] !== undefined ? String(params[k]) : `{{${k}}}`);
}

export function createI18n(locale: Locale = 'en'): I18n {
  function t(key: string, params?: Record<string, any>, lang: Locale = locale): string {
    const dict = translations[lang] || translations['en'];
    const template = dict[key] || key;
    return interpolate(template, params);
  }

  return { t };
}
