/**
 * Flashcard Study System Module
 * Handles logic for retrieving flashcards, user progress, ratings, and scheduling.
 */

/**
 * Gets all flashcards for a specific deck, processed with user's progress.
 *
 * @param {string} deckName - Name of the deck
 * @return {Object} {success: boolean, deckName?: string, cards?: Array<Object>, totalCards?: number, dueCards?: number, message?: string}
 *                  Each card object in the 'cards' array is the full card data from the sheet,
 *                  augmented with progress fields: rating, lastReview, nextDue, interval, isDue.
 */
function getFlashcardsForDeck(deckName) {
  const user = getCurrentUserInfo(); // From Authentication.js

  // PHASE 1 LOGGING: Entry point log
  Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - Entry for deck "${deckName}". User: ${user ? user.userName : 'Not Logged In'}`);

  try {
    if (!user) {
      Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - User not logged in when trying to access deck "${deckName}".`);
      return { success: false, message: 'User not logged in. Please log in to study decks.' };
    }

    const rawCards = getDeckFlashcards(deckName); // From Database.js
    // PHASE 1 LOGGING: Log raw cards received
    if (rawCards) {
      Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - Raw cards from getDeckFlashcards for ${deckName} (first 3 or fewer): ${JSON.stringify(rawCards.slice(0, 3))}`);
      Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - Total raw cards received for ${deckName}: ${rawCards.length}`);
    } else {
      Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - CRITICAL - getDeckFlashcards returned null or undefined for deck "${deckName}".`);
      return { success: false, message: `Failed to retrieve card data for deck "${deckName}" (internal error: rawCards was null/undefined).`};
    }


    const userProgress = getUserDeckProgress(user.userName, deckName, rawCards.map(c => c.FlashcardID));
    // PHASE 1 LOGGING: Log a sample of user progress
    if (userProgress && rawCards.length > 0 && rawCards[0] && rawCards[0].FlashcardID) {
        const firstCardId = rawCards[0].FlashcardID;
        Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - User progress for ${deckName} for card ${firstCardId} (if exists): ${JSON.stringify(userProgress[firstCardId])}`);
    } else if (!userProgress) {
        Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - CRITICAL - getUserDeckProgress returned null or undefined for deck "${deckName}".`);
        return { success: false, message: `Failed to retrieve user progress for deck "${deckName}" (internal error: userProgress was null/undefined).`};
    }


    const processedCards = processCardsWithProgress(rawCards, userProgress);
    // PHASE 1 LOGGING: Log processed cards
     if (processedCards) {
        Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - Final processed card for client (first 3 or fewer) for ${deckName}: ${JSON.stringify(processedCards.slice(0, 3))}`);
        Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - Total processed cards for ${deckName}: ${processedCards.length}`);
    } else {
        Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - CRITICAL - processCardsWithProgress returned null or undefined for deck "${deckName}".`);
        return { success: false, message: `Failed to process card data for deck "${deckName}" (internal error: processedCards was null/undefined).`};
    }


    const result = {
      success: true,
      deckName: deckName,
      cards: processedCards, // These cards now have 'id' property as well.
      totalCards: processedCards.length,
      dueCards: processedCards.filter(card => card.isDue).length
    };

    // PHASE 1 LOGGING: Success log
    Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - Successfully prepared result for deck "${deckName}". Total cards: ${result.totalCards}, Due: ${result.dueCards}.`);
    return result;

  } catch (error) {
    const userNameForLog = user ? user.userName : 'N/A';
    const errorMessageForLog = (error && typeof error.message === 'string') ? error.message : String(error);
    const errorStackForLog = (error && typeof error.stack === 'string') ? error.stack : 'No stack available';

    Logger.log(`FlashcardSystem.js: getFlashcardsForDeck - Error (Deck: ${deckName}, User: ${userNameForLog}): ${errorMessageForLog}\nStack: ${errorStackForLog}`);

    if (errorMessageForLog.toLowerCase().includes("not found")) {
        return { success: false, message: `Could not load deck "${deckName}". It might not exist or there was an issue accessing it.` };
    }
    return { success: false, message: `Server error getting flashcards for deck "${deckName}": ${errorMessageForLog}` };
  }
}

/**
 * Gets or initializes user progress data for a specific deck from the deck's sheet.
 * If user-specific columns don't exist, they are created.
 *
 * @param {string} username - Username
 * @param {string} deckName - Name of the deck
 * @param {Array<string>} cardIdsInDeck - An array of all FlashcardIDs in the current deck.
 * @return {Object} Progress data keyed by card ID { cardId: {rating, lastReview, nextDue, interval} }
 * @throws {Error} If deck sheet cannot be accessed or essential columns are missing.
 */
function getUserDeckProgress(username, deckName, cardIdsInDeck) {
  Logger.log(`FlashcardSystem.js: getUserDeckProgress - Getting progress for user "${username}" in deck "${deckName}". cardIdsInDeck count: ${cardIdsInDeck.length}`); // PHASE 1 LOGGING
  const ss = getDatabaseSpreadsheet();
  const deckSheet = ss.getSheetByName(deckName);

  if (!deckSheet) {
    Logger.log(`FlashcardSystem.js: getUserDeckProgress - CRITICAL: Deck sheet "${deckName}" not found.`);
    throw new Error(`Deck sheet "${deckName}" not found while trying to get user progress.`);
  }

  const dataRange = deckSheet.getDataRange();
  const allSheetData = dataRange.getValues();
  const headers = allSheetData[0].map(h => String(h).trim());
  Logger.log(`FlashcardSystem.js: getUserDeckProgress - Headers for deck "${deckName}": ${JSON.stringify(headers)}`); // PHASE 1 LOGGING

  const cardIdColIndex = headers.indexOf('FlashcardID');
  if (cardIdColIndex === -1) {
    Logger.log(`FlashcardSystem.js: getUserDeckProgress - CRITICAL: FlashcardID column not found in deck "${deckName}".`);
    throw new Error(`FlashcardID column is missing in deck "${deckName}". Cannot track progress.`);
  }

  const userRatingCol = `${username}_Rating`;
  const userLastReviewCol = `${username}_LastReview`;
  const userNextDueCol = `${username}_NextDue`;

  let ratingColIndex = headers.indexOf(userRatingCol);
  let lastReviewColIndex = headers.indexOf(userLastReviewCol);
  let nextDueColIndex = headers.indexOf(userNextDueCol);

  // PHASE 1 LOGGING: Log current state of progress columns
  Logger.log(`FlashcardSystem.js: getUserDeckProgress - Progress column indices for user "${username}": Rating=${ratingColIndex}, LastReview=${lastReviewColIndex}, NextDue=${nextDueColIndex}`);

  if (ratingColIndex === -1 || lastReviewColIndex === -1 || nextDueColIndex === -1) {
    Logger.log(`FlashcardSystem.js: getUserDeckProgress - One or more progress columns missing for user "${username}". Attempting to create them.`); // PHASE 1 LOGGING
    const lastHeaderColumn = headers.length;
    const newHeaders = [];
    if (ratingColIndex === -1) newHeaders.push(userRatingCol);
    if (lastReviewColIndex === -1) newHeaders.push(userLastReviewCol);
    if (nextDueColIndex === -1) newHeaders.push(userNextDueCol);

    if (newHeaders.length > 0) {
        deckSheet.getRange(1, lastHeaderColumn + 1, 1, newHeaders.length).setValues([newHeaders]).setFontWeight('bold');
        // Refresh headers and indices after adding new columns
        const updatedHeadersAll = deckSheet.getRange(1, 1, 1, deckSheet.getLastColumn()).getValues();
        if (updatedHeadersAll && updatedHeadersAll[0]) {
            const updatedHeaders = updatedHeadersAll[0].map(h => String(h).trim());
            ratingColIndex = updatedHeaders.indexOf(userRatingCol);
            lastReviewColIndex = updatedHeaders.indexOf(userLastReviewCol);
            nextDueColIndex = updatedHeaders.indexOf(userNextDueCol);
            Logger.log(`FlashcardSystem.js: getUserDeckProgress - Added progress columns for user "${username}" in deck "${deckName}". New indices: Rating=${ratingColIndex}, LastReview=${lastReviewColIndex}, NextDue=${nextDueColIndex}`);
        } else {
            Logger.log(`FlashcardSystem.js: getUserDeckProgress - CRITICAL: Failed to refresh headers after adding columns for user "${username}".`);
            throw new Error(`Failed to setup progress columns for user "${username}" in deck "${deckName}".`);
        }
    }
  }

  const progressData = {};
  // Initialize progressData with defaults for all card IDs expected in the deck
  cardIdsInDeck.forEach(id => {
      progressData[id] = { rating: 0, lastReview: null, nextDue: null, interval: 1 }; // Default interval for new cards
  });

  for (let i = 1; i < allSheetData.length; i++) {
    const row = allSheetData[i];
    const cardId = row[cardIdColIndex];

    if (cardId && progressData.hasOwnProperty(cardId)) { // Process only if cardId is valid and expected
      const rating = (ratingColIndex !== -1 && row[ratingColIndex] !== '' && row[ratingColIndex] !== null) ? parseInt(row[ratingColIndex], 10) : 0;
      const lastReviewValue = (lastReviewColIndex !== -1 && row[lastReviewColIndex]) ? row[lastReviewColIndex] : null;
      const nextDueValue = (nextDueColIndex !== -1 && row[nextDueColIndex]) ? row[nextDueColIndex] : null;

      const lastReview = (lastReviewValue && new Date(lastReviewValue) instanceof Date && !isNaN(new Date(lastReviewValue))) ? new Date(lastReviewValue) : null;
      const nextDue = (nextDueValue && new Date(nextDueValue) instanceof Date && !isNaN(new Date(nextDueValue))) ? new Date(nextDueValue) : null;

      progressData[cardId] = {
        rating: isNaN(rating) ? 0 : rating,
        lastReview: lastReview,
        nextDue: nextDue,
        interval: calculateInterval(isNaN(rating) ? 0 : rating)
      };
    } else if (cardId) {
      // This case means a card ID exists in the sheet but was not in cardIdsInDeck (e.g., if getDeckFlashcards filtered it out)
      // Or, progressData.hasOwnProperty(cardId) was false, which shouldn't happen if cardIdsInDeck is from getDeckFlashcards.
      Logger.log(`FlashcardSystem.js: getUserDeckProgress - Card ID "${cardId}" from sheet row ${i+1} was not in the initial cardIdsInDeck list or had no property in progressData. Skipping.`);
    }
  }
  // PHASE 1 LOGGING: Log a sample of the composed progress data
  if (cardIdsInDeck.length > 0 && progressData[cardIdsInDeck[0]]) {
    Logger.log(`FlashcardSystem.js: getUserDeckProgress - Sample composed progress for card ${cardIdsInDeck[0]} for user "${username}": ${JSON.stringify(progressData[cardIdsInDeck[0]])}`);
  }
  return progressData;
}


/**
 * Calculates the study interval for spaced repetition based on rating.
 *
 * @param {number} rating - The rating (0=Again, 1=Hard, 2=Good, 3=Easy)
 * @return {number} Interval in days
 */
function calculateInterval(rating) {
  // Intervals: 0 (Again)=1 day, 1 (Hard)=3 days, 2 (Good)=7 days, 3 (Easy)=14 days.
  // Adjust these intervals as per your desired SRS logic.
  const intervals = [1, 3, 7, 14]; // Example intervals in days
  return intervals[Math.max(0, Math.min(rating, intervals.length - 1))] || 1; // Fallback to 1 day
}

/**
 * Combines raw card data with user progress data and determines if cards are due.
 *
 * @param {Array<Object>} rawCards - Array of flashcard objects from the sheet
 * @param {Object} userProgress - User progress data keyed by card ID
 * @return {Array<Object>} Processed cards with merged progress info and 'isDue' status
 */
function processCardsWithProgress(rawCards, userProgress) {
  Logger.log(`FlashcardSystem.js: processCardsWithProgress - Processing ${rawCards.length} raw cards.`); // PHASE 1 LOGGING
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize 'now' to the beginning of the current day for due date comparison

  return rawCards.map((card, index) => {
    // Defensive: Ensure card.FlashcardID exists. If getDeckFlashcards guarantees this, it's fine.
    if (!card || !card.FlashcardID) {
      Logger.log(`FlashcardSystem.js: processCardsWithProgress - Skipping a card at index ${index} due to missing FlashcardID.`);
      return null; // Or handle as error
    }

    const progress = userProgress[card.FlashcardID] || {
      rating: 0,
      lastReview: null,
      nextDue: null, // New cards or cards never reviewed will have null nextDue
      interval: calculateInterval(0) // Default interval for new cards
    };

    let isDue = true; // Assume due by default (e.g., for new cards)
    if (progress.nextDue) { // If there is a nextDue date
      const nextDueDate = progress.nextDue instanceof Date ? new Date(progress.nextDue.getTime()) : null;
      if (nextDueDate) { // Check if nextDueDate is a valid Date
        nextDueDate.setHours(0,0,0,0); // Normalize nextDueDate to the beginning of its day
        isDue = nextDueDate <= now;
      }
      // If nextDue is null or invalid, it remains `isDue = true` (due now)
    }

    // PHASE 1 LOGGING for the first card being processed
    if (index === 0) {
        Logger.log(`FlashcardSystem.js: processCardsWithProgress - First card (${card.FlashcardID}) processing: ` +
                   `Progress: ${JSON.stringify(progress)}, Now: ${now.toISOString()}, NextDue (normalized): ${progress.nextDue ? new Date(progress.nextDue).toISOString() : 'N/A'}, isDue: ${isDue}`);
    }

    return {
      ...card, // Spread original card properties (FlashcardSideA, B, C, Tags, StudyConfig etc.)
      id: card.FlashcardID, // Ensure 'id' is available for client-side consistency
      rating: progress.rating,
      lastReview: progress.lastReview instanceof Date ? progress.lastReview.toISOString() : null,
      nextDue: progress.nextDue instanceof Date ? progress.nextDue.toISOString() : null,
      interval: progress.interval,
      isDue: isDue
    };
  }).filter(card => card !== null); // Filter out any null cards if skipped
}

/**
 * Records a user's rating for a flashcard and updates its next due date.
 *
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @param {number} rating - Rating (0-3)
 * @return {Object} {success: boolean, message: string, nextDue?: Date, interval?: number}
 */
function recordCardRating(deckName, cardId, rating) {
  Logger.log(`FlashcardSystem.js: recordCardRating - Deck: ${deckName}, Card: ${cardId}, Rating: ${rating}`); // PHASE 1 LOGGING
  try {
    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 3) {
      Logger.log(`FlashcardSystem.js: recordCardRating - Invalid rating value: ${rating}`);
      return { success: false, message: 'Invalid rating value. Must be between 0 and 3.' };
    }

    const user = getCurrentUserInfo();
    if (!user) {
      Logger.log(`FlashcardSystem.js: recordCardRating - User not logged in.`);
      return { success: false, message: 'User not logged in. Cannot record rating.' };
    }
    Logger.log(`FlashcardSystem.js: recordCardRating - User: ${user.userName}`);

    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);
    if (!deckSheet) {
      Logger.log(`FlashcardSystem.js: recordCardRating - Deck "${deckName}" not found.`);
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const dataRange = deckSheet.getDataRange();
    const allSheetData = dataRange.getValues();
    const headers = allSheetData[0].map(h => String(h).trim());
    Logger.log(`FlashcardSystem.js: recordCardRating - Headers for ${deckName}: ${JSON.stringify(headers)}`);

    const cardIdColIndex = headers.indexOf('FlashcardID');
    if (cardIdColIndex === -1) {
        Logger.log(`FlashcardSystem.js: recordCardRating - FlashcardID column not found in deck.`);
        return { success: false, message: 'FlashcardID column not found in deck.' };
    }

    const userRatingCol = `${user.userName}_Rating`;
    const userLastReviewCol = `${user.userName}_LastReview`;
    const userNextDueCol = `${user.userName}_NextDue`;

    let ratingColIndex = headers.indexOf(userRatingCol);
    let lastReviewColIndex = headers.indexOf(userLastReviewCol);
    let nextDueColIndex = headers.indexOf(userNextDueCol);
    Logger.log(`FlashcardSystem.js: recordCardRating - Initial progress col indices: R=${ratingColIndex}, LR=${lastReviewColIndex}, ND=${nextDueColIndex}`);


    if (ratingColIndex === -1 || lastReviewColIndex === -1 || nextDueColIndex === -1) {
        Logger.log(`FlashcardSystem.js: recordCardRating - Progress columns for ${user.userName} missing in ${deckName}. Forcing creation.`);
        const lastHeaderColumn = headers.length;
        const newHeadersToAdd = [];
        if (ratingColIndex === -1) { newHeadersToAdd.push(userRatingCol); headers.push(userRatingCol); } // Add to current headers array too for index finding
        if (lastReviewColIndex === -1) { newHeadersToAdd.push(userLastReviewCol); headers.push(userLastReviewCol); }
        if (nextDueColIndex === -1) { newHeadersToAdd.push(userNextDueCol); headers.push(userNextDueCol); }


        if (newHeadersToAdd.length > 0) {
            deckSheet.getRange(1, lastHeaderColumn + 1, 1, newHeadersToAdd.length).setValues([newHeadersToAdd]).setFontWeight('bold');
            // Re-fetch indices from the updated headers array
            ratingColIndex = headers.indexOf(userRatingCol);
            lastReviewColIndex = headers.indexOf(userLastReviewCol);
            nextDueColIndex = headers.indexOf(userNextDueCol);
            Logger.log(`FlashcardSystem.js: recordCardRating - Created progress columns. New indices: R=${ratingColIndex}, LR=${lastReviewColIndex}, ND=${nextDueColIndex}`);
        }
        if (ratingColIndex === -1 || lastReviewColIndex === -1 || nextDueColIndex === -1) { // Check again
             Logger.log(`FlashcardSystem.js: recordCardRating - Failed to create/find user progress columns after attempt. Cannot record rating.`);
             return { success: false, message: 'Failed to create user progress columns. Cannot record rating.' };
        }
    }


    let cardRowSheetIndex = -1; // This is the 1-based index for getRange()
    for (let i = 1; i < allSheetData.length; i++) { // Iterate data rows (0-based for allSheetData array)
      if (allSheetData[i][cardIdColIndex] === cardId) {
        cardRowSheetIndex = i + 1; // Sheet rows are 1-indexed
        break;
      }
    }

    if (cardRowSheetIndex === -1) {
      Logger.log(`FlashcardSystem.js: recordCardRating - Card ID "${cardId}" not found in deck "${deckName}".`);
      return { success: false, message: `Card ID "${cardId}" not found in deck "${deckName}".` };
    }
    Logger.log(`FlashcardSystem.js: recordCardRating - Found card ${cardId} at sheet row ${cardRowSheetIndex}.`);


    const intervalDays = calculateInterval(parsedRating);
    const now = new Date();
    const nextDueDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    Logger.log(`FlashcardSystem.js: recordCardRating - Calculated interval: ${intervalDays} days. Next due: ${nextDueDate.toISOString()}`);


    deckSheet.getRange(cardRowSheetIndex, ratingColIndex + 1).setValue(parsedRating);
    deckSheet.getRange(cardRowSheetIndex, lastReviewColIndex + 1).setValue(now);
    deckSheet.getRange(cardRowSheetIndex, nextDueColIndex + 1).setValue(nextDueDate);

    Logger.log(`FlashcardSystem.js: recordCardRating - Rating recorded for User: ${user.userName}, Deck: ${deckName}, Card: ${cardId}, Rating: ${parsedRating}, NextDue: ${nextDueDate.toISOString()}`);
    return {
      success: true,
      message: 'Rating recorded successfully.',
      nextDue: nextDueDate.toISOString(),
      interval: intervalDays
    };
  } catch (error) {
    Logger.log(`FlashcardSystem.js: recordCardRating - Error (Deck: ${deckName}, Card: ${cardId}, Rating: ${rating}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error recording card rating: ${error.message}` };
  }
}

/**
 * Gets due cards statistics for a user across all their available decks.
 *
 * @return {Object} {success: boolean, decks?: Array<string>, dueCardsByDeck?: Object, message?: string}
 *                  dueCardsByDeck format: { deckName: {totalCards, dueCards} }
 */
function getUserDueCards() {
  // PHASE 1 LOGGING: Less critical for individual card view, but good for context.
  Logger.log(`FlashcardSystem.js: getUserDueCards - Starting for current user.`);
  try {
    const user = getCurrentUserInfo();
    if (!user) {
      Logger.log(`FlashcardSystem.js: getUserDueCards - User not logged in.`);
      return { success: false, message: 'User not logged in.' };
    }
    Logger.log(`FlashcardSystem.js: getUserDueCards - User: ${user.userName}`);


    const decksResult = getAvailableDecks(true); // Exclude system sheets
    if (!decksResult.success || !decksResult.decks) {
      Logger.log(`FlashcardSystem.js: getUserDueCards - Could not retrieve available decks: ${decksResult.message}`);
      return { success: false, message: decksResult.message || 'Could not retrieve available decks.' };
    }
    Logger.log(`FlashcardSystem.js: getUserDueCards - Available decks for user: ${JSON.stringify(decksResult.decks)}`);


    const dueCardsByDeck = {};
    const userDecks = decksResult.decks;

    userDecks.forEach(deckName => {
      Logger.log(`FlashcardSystem.js: getUserDueCards - Processing deck: ${deckName}`);
      try {
        // IMPORTANT: This calls getFlashcardsForDeck, which now has extensive logging.
        // Avoid re-logging the same details here unless specifically for due card calculation context.
        const deckInfo = getFlashcardsForDeck(deckName); // This will re-log its internal steps
        if (deckInfo.success) {
          dueCardsByDeck[deckName] = {
            totalCards: deckInfo.totalCards,
            dueCards: deckInfo.dueCards
          };
          Logger.log(`FlashcardSystem.js: getUserDueCards - Deck ${deckName}: Total=${deckInfo.totalCards}, Due=${deckInfo.dueCards}`);
        } else {
          Logger.log(`FlashcardSystem.js: getUserDueCards - Could not get card info for deck "${deckName}" for user "${user.userName}" during due card calculation: ${deckInfo.message}`);
          dueCardsByDeck[deckName] = { totalCards: 'N/A', dueCards: 'N/A', error: deckInfo.message };
        }
      } catch (e) {
        Logger.log(`FlashcardSystem.js: getUserDueCards - Error processing deck "${deckName}" for due cards (User: ${user.userName}): ${e.message}`);
        dueCardsByDeck[deckName] = { totalCards: 'N/A', dueCards: 'N/A', error: e.message };
      }
    });

    Logger.log(`FlashcardSystem.js: getUserDueCards - Successfully calculated due cards by deck: ${JSON.stringify(dueCardsByDeck)}`);
    return {
      success: true,
      decks: userDecks,
      dueCardsByDeck: dueCardsByDeck
    };
  } catch (error) {
    Logger.log(`FlashcardSystem.js: getUserDueCards - Error (User: ${getCurrentUserInfo() ? getCurrentUserInfo().userName : 'N/A'}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error getting user due cards: ${error.message}` };
  }
}

/**
 * Resets a user's study progress for a specific deck.
 * Clears rating, last review, and next due date for all cards in that deck for the user.
 *
 * @param {string} deckName - Name of the deck
 * @return {Object} {success: boolean, message: string}
 */
function resetDeckProgress(deckName) {
  // PHASE 1 LOGGING: Less critical for individual card view.
  Logger.log(`FlashcardSystem.js: resetDeckProgress - Deck: ${deckName}`);
  try {
    const user = getCurrentUserInfo();
    if (!user) {
      return { success: false, message: 'User not logged in. Cannot reset progress.' };
    }

    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);
    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const headers = deckSheet.getRange(1, 1, 1, deckSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const userRatingCol = `${user.userName}_Rating`;
    const userLastReviewCol = `${user.userName}_LastReview`;
    const userNextDueCol = `${user.userName}_NextDue`;

    const ratingColIndex = headers.indexOf(userRatingCol);
    const lastReviewColIndex = headers.indexOf(userLastReviewCol);
    const nextDueColIndex = headers.indexOf(userNextDueCol);

    // Check if any progress columns actually exist for this user
    if (ratingColIndex === -1 && lastReviewColIndex === -1 && nextDueColIndex === -1) {
      Logger.log(`FlashcardSystem.js: resetDeckProgress - No progress data found for user "${user.userName}" in deck "${deckName}" to reset.`);
      return { success: true, message: `No progress data found for user "${user.userName}" in deck "${deckName}" to reset.` };
    }

    const numRows = deckSheet.getLastRow();
    if (numRows > 1) { // Only clear if there are data rows
      if (ratingColIndex !== -1) {
        deckSheet.getRange(2, ratingColIndex + 1, numRows - 1, 1).clearContent();
        Logger.log(`FlashcardSystem.js: resetDeckProgress - Cleared rating column for ${user.userName} in ${deckName}`);
      }
      if (lastReviewColIndex !== -1) {
        deckSheet.getRange(2, lastReviewColIndex + 1, numRows - 1, 1).clearContent();
        Logger.log(`FlashcardSystem.js: resetDeckProgress - Cleared last review column for ${user.userName} in ${deckName}`);
      }
      if (nextDueColIndex !== -1) {
        deckSheet.getRange(2, nextDueColIndex + 1, numRows - 1, 1).clearContent();
        Logger.log(`FlashcardSystem.js: resetDeckProgress - Cleared next due column for ${user.userName} in ${deckName}`);
      }
    }

    Logger.log(`FlashcardSystem.js: resetDeckProgress - Progress reset for User: ${user.userName}, Deck: ${deckName}`);
    return {
      success: true,
      message: `Progress for deck "${deckName}" has been reset successfully.`
    };
  } catch (error) {
    Logger.log(`FlashcardSystem.js: resetDeckProgress - Error (Deck: ${deckName}, User: ${getCurrentUserInfo() ? getCurrentUserInfo().userName : 'N/A'}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error resetting deck progress: ${error.message}` };
  }
}