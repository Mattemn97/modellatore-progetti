/* --- ERRORI DELLE API: { errore, messaggio } CON IL CODICE HTTP --- */

export class ErroreApi extends Error {
    constructor(
        readonly stato: number,
        readonly codice: string,
        messaggio: string,
        readonly extra: Record<string, unknown> = {}
    ) {
        super(messaggio);
    }

    corpo(): Record<string, unknown> {
        return { errore: this.codice, messaggio: this.message, ...this.extra };
    }
}

export const nonConsentito = (): ErroreApi => new ErroreApi(405, 'metodo_non_consentito', 'Metodo non consentito.');
export const nonTrovatoApi = (): ErroreApi => new ErroreApi(404, 'non_trovato', 'Indirizzo API sconosciuto.');
