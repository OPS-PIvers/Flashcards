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
  const user = getCurrentUserInfo(); 

  try {
    // Logger.log(`getFlashcardsForDeck: Entry for deck "${deckName}". User object: ${JSON.stringify(user)}`); // Can be verbose

    if (!user) {
      Logger.log(`getFlashcardsForDeck: User not logged in when trying to access deck "${deckName}".`);
      return { success: false, message: 'User not logged in. Please log in to study decks.' };
    }

    Logger.log(`getFlashcardsForDeck: Starting for deck "${deckName}", user "${user.userName}".`);

    const rawCards = getDeckFlashcards(deckName);
    Logger.log(`getFlashcardsForDeck: Call to getDeckFlashcards completed. Received ${rawCards ? rawCards.length : 'null/undefined'} raw cards for deck "${deckName}".`);
    
    if (!rawCards) { 
        Logger.log(`getFlashcardsForDeck: CRITICAL - getDeckFlashcards returned null or undefined for deck "${deckName}".`);
        return { success: false, message: `Failed to retrieve card data for deck "${deckName}" (internal error: rawCards was null/undefined).`};
    }

    const userProgress = getUserDeckProgress(user.userName, deckName, rawCards.map(c => c.FlashcardID));
    Logger.log(`getFlashcardsForDeck: Call to getUserDeckProgress completed. Received progress for ${userProgress ? Object.keys(userProgress).length : 'null/undefined'} cards for deck "${deckName}".`);
    
    if (!userProgress) { 
        Logger.log(`getFlashcardsForDeck: CRITICAL - getUserDeckProgress returned null or undefined for deck "${deckName}".`);
        return { success: false, message: `Failed to retrieve user progress for deck "${deckName}" (internal error: userProgress was null/undefined).`};
    }
    
    const processedCards = processCardsWithProgress(rawCards, userProgress);
    Logger.log(`getFlashcardsForDeck: Call to processCardsWithProgress completed. Processed ${processedCards ? processedCards.length : 'null/undefined'} cards for deck "${deckName}".`);
    
    if (!processedCards) { 
        Logger.log(`getFlashcardsForDeck: CRITICAL - processCardsWithProgress returned null or undefined for deck "${deckName}".`);
        return { success: false, message: `Failed to process card data for deck "${deckName}" (internal error: processedCards was null/undefined).`};
    }

    const result = {
      success: true,
      deckName: deckName,
      cards: processedCards,
      totalCards: processedCards.length,
      dueCards: processedCards.filter(card => card.isDue).length
    };
    
    Logger.log(`getFlashcardsForDeck: Successfully prepared result for deck "${deckName}". Total cards: ${result.totalCards}, Due: ${result.dueCards}. Returning success.`);
    return result;

  } catch (error) {
    const userNameForLog = user ? user.userName : 'N/A (user object was null or became null at function start)';
    const errorMessageForLog = (error && typeof error.message === 'string') ? error.message : String(error); 
    const errorStackForLog = (error && typeof error.stack === 'string') ? error.stack : 'No stack available';
    
    Logger.log(`Error in getFlashcardsForDeck (Deck: ${deckName}, User: ${userNameForLog}): ${errorMessageForLog}\nStack: ${errorStackForLog}`);

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
  const ss = getDatabaseSpreadsheet(); // Assumes getDatabaseSpreadsheet from Database.js/Code.js
  const deckSheet = ss.getSheetByName(deckName);

  if (!deckSheet) {
    Logger.log(`CRITICAL: Deck sheet "${deckName}" not found in getUserDeckProgress.`);
    throw new Error(`Deck sheet "${deckName}" not found while trying to get user progress.`);
  }

  const dataRange = deckSheet.getDataRange();
  const allSheetData = dataRange.getValues();
  const headers = allSheetData[0].map(h => String(h).trim());

  const cardIdColIndex = headers.indexOf('FlashcardID');
  if (cardIdColIndex === -1) {
    Logger.log(`CRITICAL: FlashcardID column not found in deck "${deckName}".`);
    throw new Error(`FlashcardID column is missing in deck "${deckName}". Cannot track progress.`);
  }

  const userRatingCol = `${username}_Rating`;
  const userLastReviewCol = `${username}_LastReview`;
  const userNextDueCol = `${username}_NextDue`;

  let ratingColIndex = headers.indexOf(userRatingCol);
  let lastReviewColIndex = headers.indexOf(userLastReviewCol);
  let nextDueColIndex = headers.indexOf(userNextDueCol);

  if (ratingColIndex === -1 || lastReviewColIndex === -1 || nextDueColIndex === -1) {
    const lastHeaderColumn = headers.length;
    const newHeaders = [];
    if (ratingColIndex === -1) newHeaders.push(userRatingCol);
    if (lastReviewColIndex === -1) newHeaders.push(userLastReviewCol);
    if (nextDueColIndex === -1) newHeaders.push(userNextDueCol);

    if (newHeaders.length > 0) {
        deckSheet.getRange(1, lastHeaderColumn + 1, 1, newHeaders.length).setValues([newHeaders]).setFontWeight('bold');
        const updatedHeaders = deckSheet.getRange(1, 1, 1, deckSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        ratingColIndex = updatedHeaders.indexOf(userRatingCol);
        lastReviewColIndex = updatedHeaders.indexOf(userLastReviewCol);
        nextDueColIndex = updatedHeaders.indexOf(userNextDueCol);
        Logger.log(`Added progress columns for user "${username}" in deck "${deckName}".`);
    }
  }

  const progressData = {};
  cardIdsInDeck.forEach(id => {
      progressData[id] = { rating: 0, lastReview: null, nextDue: null, interval: 1 };
  });

  for (let i = 1; i < allSheetData.length; i++) {
    const row = allSheetData[i];
    const cardId = row[cardIdColIndex];

    if (cardId && progressData.hasOwnProperty(cardId)) { 
      const rating = (ratingColIndex !== -1 && row[ratingColIndex] !== '') ? parseInt(row[ratingColIndex], 10) : 0;
      const lastReview = (lastReviewColIndex !== -1 && row[lastReviewColIndex]) ? new Date(row[lastReviewColIndex]) : null;
      const nextDue = (nextDueColIndex !== -1 && row[nextDueColIndex]) ? new Date(row[nextDueColIndex]) : null;

      progressData[cardId] = {
        rating: isNaN(rating) ? 0 : rating,
        lastReview: (lastReview && !isNaN(lastReview.getTime())) ? lastReview : null,
        nextDue: (nextDue && !isNaN(nextDue.getTime())) ? nextDue : null,
        interval: calculateInterval(isNaN(rating) ? 0 : rating) 
      };
    }
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
  const intervals = [1, 3, 7, 14]; 
  return intervals[Math.max(0, Math.min(rating, intervals.length - 1))] || 1; 
}

/**
 * Combines raw card data with user progress data and determines if cards are due.
 *
 * @param {Array<Object>} rawCards - Array of flashcard objects from the sheet
 * @param {Object} userProgress - User progress data keyed by card ID
 * @return {Array<Object>} Processed cards with merged progress info and 'isDue' status
 */
function processCardsWithProgress(rawCards, userProgress) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); 

  return rawCards.map(card => {
    const progress = userProgress[card.FlashcardID] || {
      rating: 0,
      lastReview: null,
      nextDue: null,
      interval: calculateInterval(0) 
    };

    let isDue = true; 
    if (progress.nextDue) {
      const nextDueDate = progress.nextDue instanceof Date ? new Date(progress.nextDue.getTime()) : null; 
      if (nextDueDate) {
        nextDueDate.setHours(0,0,0,0); 
        isDue = nextDueDate <= now;
      }
    }
    
    return {
      ...card, 
      id: card.FlashcardID, 
      rating: progress.rating,
      lastReview: progress.lastReview instanceof Date ? progress.lastReview.toISOString() : null,
      nextDue: progress.nextDue instanceof Date ? progress.nextDue.toISOString() : null,
      interval: progress.interval,
      isDue: isDue
    };
  });
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
  try {
    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 3) {
      return { success: false, message: 'Invalid rating value. Must be between 0 and 3.' };
    }

    const user = getCurrentUserInfo();
    if (!user) {
      return { success: false, message: 'User not logged in. Cannot record rating.' };
    }

    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);
    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found.` };
    }

    const dataRange = deckSheet.getDataRange();
    const allSheetData = dataRange.getValues();
    const headers = allSheetData[0].map(h => String(h).trim());

    const cardIdColIndex = headers.indexOf('FlashcardID');
    if (cardIdColIndex === -1) {
        return { success: false, message: 'FlashcardID column not found in deck.' };
    }

    const userRatingCol = `${user.userName}_Rating`;
    const userLastReviewCol = `${user.userName}_LastReview`;
    const userNextDueCol = `${user.userName}_NextDue`;

    let ratingColIndex = headers.indexOf(userRatingCol);
    let lastReviewColIndex = headers.indexOf(userLastReviewCol);
    let nextDueColIndex = headers.indexOf(userNextDueCol);

    if (ratingColIndex === -1 || lastReviewColIndex === -1 || nextDueColIndex === -1) {
        Logger.log(`Progress columns for ${user.userName} missing in ${deckName} during rating. Forcing creation.`);
        const lastHeaderColumn = headers.length;
        const newHeadersToAdd = [];
        if (ratingColIndex === -1) newHeadersToAdd.push(userRatingCol);
        if (lastReviewColIndex === -1) newHeadersToAdd.push(userLastReviewCol);
        if (nextDueColIndex === -1) newHeadersToAdd.push(userNextDueCol);

        if (newHeadersToAdd.length > 0) {
            deckSheet.getRange(1, lastHeaderColumn + 1, 1, newHeadersToAdd.length).setValues([newHeadersToAdd]).setFontWeight('bold');
            const refreshedHeaders = deckSheet.getRange(1, 1, 1, deckSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
            ratingColIndex = refreshedHeaders.indexOf(userRatingCol);
            lastReviewColIndex = refreshedHeaders.indexOf(userLastReviewCol);
            nextDueColIndex = refreshedHeaders.indexOf(userNextDueCol);
        }
        if (ratingColIndex === -1 || lastReviewColIndex === -1 || nextDueColIndex === -1) {
             return { success: false, message: 'Failed to create user progress columns. Cannot record rating.' };
        }
    }


    let cardRowSheetIndex = -1; 
    for (let i = 1; i < allSheetData.length; i++) {
      if (allSheetData[i][cardIdColIndex] === cardId) {
        cardRowSheetIndex = i + 1;
        break;
      }
    }

    if (cardRowSheetIndex === -1) {
      return { success: false, message: `Card ID "${cardId}" not found in deck "${deckName}".` };
    }

    const intervalDays = calculateInterval(parsedRating);
    const now = new Date();
    const nextDueDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    deckSheet.getRange(cardRowSheetIndex, ratingColIndex + 1).setValue(parsedRating);
    deckSheet.getRange(cardRowSheetIndex, lastReviewColIndex + 1).setValue(now);
    deckSheet.getRange(cardRowSheetIndex, nextDueColIndex + 1).setValue(nextDueDate);

    Logger.log(`Rating recorded for User: ${user.userName}, Deck: ${deckName}, Card: ${cardId}, Rating: ${parsedRating}, NextDue: ${nextDueDate.toISOString()}`);
    return {
      success: true,
      message: 'Rating recorded successfully.',
      // Return dates as ISO strings for client
      nextDue: nextDueDate.toISOString(), 
      interval: intervalDays
    };
  } catch (error) {
    Logger.log(`Error in recordCardRating (Deck: ${deckName}, Card: ${cardId}, Rating: ${rating}): ${error.message}\nStack: ${error.stack}`);
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
  try {
    const user = getCurrentUserInfo();
    if (!user) {
      return { success: false, message: 'User not logged in.' };
    }

    const decksResult = getAvailableDecks(true); 
    if (!decksResult.success || !decksResult.decks) {
      return { success: false, message: decksResult.message || 'Could not retrieve available decks.' };
    }

    const dueCardsByDeck = {};
    const userDecks = decksResult.decks;

    userDecks.forEach(deckName => {
      try {
        const deckInfo = getFlashcardsForDeck(deckName);
        if (deckInfo.success) {
          dueCardsByDeck[deckName] = {
            totalCards: deckInfo.totalCards,
            dueCards: deckInfo.dueCards
          };
        } else {
          Logger.log(`Could not get card info for deck "${deckName}" for user "${user.userName}" during due card calculation: ${deckInfo.message}`);
          dueCardsByDeck[deckName] = { totalCards: 'N/A', dueCards: 'N/A', error: deckInfo.message };
        }
      } catch (e) {
        Logger.log(`Error processing deck "${deckName}" for due cards (User: ${user.userName}): ${e.message}`);
        dueCardsByDeck[deckName] = { totalCards: 'N/A', dueCards: 'N/A', error: e.message };
      }
    });

    return {
      success: true,
      decks: userDecks,
      dueCardsByDeck: dueCardsByDeck
    };
  } catch (error) {
    Logger.log(`Error in getUserDueCards (User: ${getCurrentUserInfo() ? getCurrentUserInfo().userName : 'N/A'}): ${error.message}\nStack: ${error.stack}`);
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

    if (ratingColIndex === -1 && lastReviewColIndex === -1 && nextDueColIndex === -1) {
      return { success: true, message: `No progress data found for user "${user.userName}" in deck "${deckName}" to reset.` };
    }

    const numRows = deckSheet.getLastRow();
    if (numRows > 1) { 
      if (ratingColIndex !== -1) {
        deckSheet.getRange(2, ratingColIndex + 1, numRows - 1, 1).clearContent();
      }
      if (lastReviewColIndex !== -1) {
        deckSheet.getRange(2, lastReviewColIndex + 1, numRows - 1, 1).clearContent();
      }
      if (nextDueColIndex !== -1) {
        deckSheet.getRange(2, nextDueColIndex + 1, numRows - 1, 1).clearContent();
      }
    }

    Logger.log(`Progress reset for User: ${user.userName}, Deck: ${deckName}`);
    return {
      success: true,
      message: `Progress for deck "${deckName}" has been reset successfully.`
    };
  } catch (error) {
    Logger.log(`Error in resetDeckProgress (Deck: ${deckName}, User: ${getCurrentUserInfo() ? getCurrentUserInfo().userName : 'N/A'}): ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error resetting deck progress: ${error.message}` };
  }
}