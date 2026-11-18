import Papa from 'papaparse';
import { db } from '../logic/db';
import { NoteType } from '../logic/note/note';

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

  // We must write to both the notes and cards tables simultaneously
  await db.transaction('rw', db.notes, db.cards, async () => {
    for (const row of data) {
      const externalId = row.id?.trim();
      const front = row.en_word?.trim();
      
      const back = row.category?.trim()
        ? `${row.fr_word?.trim()}<br><small>${row.category.trim()}</small>`
        : row.fr_word?.trim();

      if (!externalId || !front || !back) continue;

      const noteId = `sheet_note_${externalId}`;
      const cardId = `sheet_card_${externalId}`;

      // This perfectly matches Skola's expected Basic Note content structure
      const noteContent = {
        type: NoteType.Basic,
        front: front,
        back: back,
      };

      const existingNote = await db.notes.get(noteId);

      if (!existingNote) {
        // 1. Create the Note (holds the text)
        await db.notes.put({
          id: noteId,
          deck: targetDeckId,
          creationDate: new Date(),
          linkedNotes: [],
          sortField: front,
          content: noteContent as any,
        });

        // 2. Create the Card (holds the FSRS math and links to the Note)
        await db.cards.put({
          id: cardId,
          note: noteId, // Link to the note we just created
          deck: targetDeckId,
          creationDate: new Date(),
          history: [],
          model: {
            due: new Date(),
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
            state: 0,
          },
          content: noteContent as any,
        } as any);

        added++;
      } else {
        // Update text edits from the Sheet without touching FSRS progress
        await db.notes.update(noteId, {
          sortField: front,
          content: noteContent as any,
        });
        
        await db.cards.update(cardId, {
          content: noteContent as any,
        });

        updated++;
      }
    }
  });

  return { added, updated };
}