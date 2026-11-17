import Papa from 'papaparse';
import { db } from '../db'; 

export interface SheetRow {
  id: string;
    fr_word: string;
      en_word: string;
        category?: string; 
        }

        const SHEET_CSV_URL = import.meta.env.VITE_SHEET_CSV_URL;

        export async function syncFromGoogleSheet(targetDeckId: string): Promise<{
          added: number;
            updated: number;
            }> {
              if (!SHEET_CSV_URL) {
                  throw new Error('Missing VITE_SHEET_CSV_URL in environment variables.');
                    }

                      const separator = SHEET_CSV_URL.includes('?') ? '&' : '?';
                        const freshUrl = `${SHEET_CSV_URL}${separator}_t=${Date.now()}`;

                          const response = await fetch(freshUrl, { cache: 'no-store' });
                            if (!response.ok) {
                                throw new Error(`Sync failed with status ${response.status}`);
                                  }

                                    const csvText = await response.text();

                                      const { data, errors } = Papa.parse<SheetRow>(csvText, {
                                          header: true,
                                              skipEmptyLines: true,
                                                  transformHeader: (header) => header.trim().toLowerCase(),
                                                    });

                                                      if (errors.length > 0) {
                                                          console.warn('CSV parse warnings:', errors);
                                                            }

                                                              let added = 0;
                                                                let updated = 0;

                                                                  await db.transaction('rw', db.cards, async () => {
                                                                      for (const row of data) {
                                                                            const externalId = row.id?.trim();
                                                                                  const front = row.en_word?.trim();
                                                                                        
                                                                                              const back = row.category?.trim()
                                                                                                      ? `${row.fr_word?.trim()}<br><small>${row.category.trim()}</small>`
                                                                                                              : row.fr_word?.trim();

                                                                                                                    if (!externalId || !front || !back) continue;

                                                                                                                          const deterministicCardId = `sheet_${externalId}`;
                                                                                                                                const existingCard = await db.cards.get(deterministicCardId);

                                                                                                                                      if (!existingCard) {
                                                                                                                                              await db.cards.add({
                                                                                                                                                        id: deterministicCardId,
                                                                                                                                                                  deckId: targetDeckId,
                                                                                                                                                                            front,
                                                                                                                                                                                      back,
                                                                                                                                                                                                createdAt: new Date(),
                                                                                                                                                                                                          due: new Date(),
                                                                                                                                                                                                                    stability: 0,
                                                                                                                                                                                                                              difficulty: 0,
                                                                                                                                                                                                                                        elapsed_days: 0,
                                                                                                                                                                                                                                                  scheduled_days: 0,
                                                                                                                                                                                                                                                            reps: 0,
                                                                                                                                                                                                                                                                      lapses: 0,
                                                                                                                                                                                                                                                                                state: 0, 
                                                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                                                                added++;
                                                                                                                                                                                                                                                                                                      } else if (existingCard.front !== front || existingCard.back !== back) {
                                                                                                                                                                                                                                                                                                              await db.cards.update(deterministicCardId, { front, back });
                                                                                                                                                                                                                                                                                                                      updated++;
                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                                                                  });

                                                                                                                                                                                                                                                                                                                                    return { added, updated };
                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                    