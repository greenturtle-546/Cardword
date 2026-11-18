// @ts-nocheck
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

export async function syncFromGoogleSheet(): Promise<{
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
  const { data } = Papa.parse<SheetRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  let added = 0;
  let updated = 0;

  await db.transaction('rw', db.decks, db.notes, db.cards, async () => {
    
    // 1. Grab existing decks or AUTO-CREATE one if the browser is empty
    const allDecks = await db.decks.toArray();
    let targetDeck;
    let targetDeckId;

    if (allDecks.length === 0) {
      targetDeckId = "indonesian_vocab_deck";
      targetDeck = {
        id: targetDeckId,
        name: "Belajar Bahasa Indonesia",
        cards: [],
        notes: [],
        subDecks: [],
        creationDate: new Date(),
      };
    } else {
      targetDeck = allDecks[0]; 
      targetDeckId = targetDeck.id;
    }

    // 2. Process the CSV rows
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
          content: noteContent,
        });

        await db.cards.put({
          id: cardId,
          note: noteId,
          deck: targetDeckId,
          creationDate: new Date(),
          history: [],
          model: { due: new Date(), stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: 0 },
          content: noteContent,
        });
        added++;
      } else {
        await db.notes.update(noteId, { sortField: front, content: noteContent });
        await db.cards.update(cardId, { content: noteContent });
        updated++;
      }

      // 3. Link the cards directly to the deck
      if (!targetDeck.notes.includes(noteId)) {
        targetDeck.notes.push(noteId);
      }
      if (!targetDeck.cards.includes(cardId)) {
        targetDeck.cards.push(cardId);
      }
    }

    // 4. Save the deck (creates it if new, updates it if existing)
    await db.decks.put(targetDeck);
  });

  return { added, updated };
}