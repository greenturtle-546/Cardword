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

  await db.transaction('rw', db.decks, db.notes, db.cards, async () => {
    
    // 1. Get the deck or create it
    let existingDeck = await db.decks.get(targetDeckId);
    if (!existingDeck) {
      existingDeck = {
        id: targetDeckId,
        name: "Indonesian Vocab",
        cards: [],
        notes: [],
        subDecks: [],
        creationDate: new Date(),
      } as any;
    }

    // 2. Process the spreadsheet data
    for (const row of data) {
      const externalId = row.id?.trim();
      const front = row.en_word?.trim();
      const back = row.category?.trim()
        ? `${row.fr_word?.trim()}<br><small>${row.category.trim()}</small>`
        : row.fr_word?.trim();

      if (!externalId || !front || !back) continue;

      const noteId = `sheet_note_${externalId}`;
      const cardId = `sheet_card_${externalId}`;

      const noteContent = { type: NoteType.Basic, front, back };
      const existingNote = await db.notes.get(noteId);

      if (!existingNote) {
        await db.notes.put({
          id: noteId,
          deck: targetDeckId,
          creationDate: new Date(),
          linkedNotes: [],
          sortField: front,
          content: noteContent as any,
        });

        await db.cards.put({
          id: cardId,
          note: noteId,
          deck: targetDeckId,
          creationDate: new Date(),
          history: [],
          model: { due: new Date(), stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: 0 },
          content: noteContent as any,
        } as any);
        added++;
      } else {
        await db.notes.update(noteId, { sortField: front, content: noteContent as any });
        await db.cards.update(cardId, { content: noteContent as any });
        updated++;
      }

      // 3. TWO-WAY BINDING: Tell the deck that it owns this card and note
      if (!existingDeck.notes.includes(noteId)) {
        existingDeck.notes.push(noteId);
      }
      if (!existingDeck.cards.includes(cardId)) {
        existingDeck.cards.push(cardId);
      }
    }

    // 4. Save the updated deck inventory back to the database
    await db.decks.put(existingDeck);
  });

  return { added, updated };
}