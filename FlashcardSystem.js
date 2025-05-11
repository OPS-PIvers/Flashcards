/**
 * Gets all flashcards for a specific deck
 * 
 * @param {string} deckName - Name of the deck
 * @return {Object} Object containing deck info and cards
 */
function getFlashcardsForDeck(deckName) {
  try {
    // Validate that deck exists
    const decksResult = getAvailableDecks();
    if (!decksResult.success) {
      return decksResult;
    }
    
    if (!decksResult.decks.includes(deckName)) {
      return { 
        success: false, 
        message: `Deck "${deckName}" not found` 
      };
    }
    
    // Get the current user
    const user = getCurrentUserInfo();
    if (!user) {
      return { 
        success: false, 
        message: 'User not logged in' 
      };
    }
    
    // Get the flashcards
    const cards = getDeckFlashcards(deckName);
    
    // Get the user's progress data for this deck
    const userProgress = getUserDeckProgress(user.userName, deckName);
    
    // Combine flashcards with user progress and schedule cards
    const processedCards = processCardsWithProgress(cards, userProgress);
    
    return {
      success: true,
      deckName: deckName,
      cards: processedCards,
      totalCards: cards.length,
      dueCards: processedCards.filter(card => card.isDue).length
    };
  } catch (error) {
    Logger.log('Error getting flashcards: ' + error.message);
    return { success: false, message: 'Error getting flashcards: ' + error.message };
  }
}

/**
 * Gets user progress data for a specific deck
 * 
 * @param {string} username - Username
 * @param {string} deckName - Name of the deck
 * @return {Object} Progress data keyed by card ID
 */
function getUserDeckProgress(username, deckName) {
  const ss = getDatabaseSpreadsheet();
  const deckSheet = ss.getSheetByName(deckName);
  
  if (!deckSheet) {
    throw new Error(`Deck "${deckName}" not found`);
  }
  
  const data = deckSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices
  const idIndex = headers.indexOf('FlashcardID');
  const userColIndex = headers.findIndex(col => col === username + '_Rating');
  const userDateIndex = headers.findIndex(col => col === username + '_LastReview');
  const userDueIndex = headers.findIndex(col => col === username + '_NextDue');
  
  // If user columns don't exist yet, create them
  if (userColIndex === -1 || userDateIndex === -1 || userDueIndex === -1) {
    return addUserColumnsToSheet(deckSheet, username, headers);
  }
  
  // Process existing progress data
  const progressData = {};
  
  for (let i = 1; i < data.length; i++) {
    const cardId = data[i][idIndex];
    const rating = data[i][userColIndex] || 0;
    const lastReview = data[i][userDateIndex] ? new Date(data[i][userDateIndex]) : null;
    const nextDue = data[i][userDueIndex] ? new Date(data[i][userDueIndex]) : null;
    
    progressData[cardId] = {
      rating: rating,
      lastReview: lastReview,
      nextDue: nextDue,
      interval: calculateInterval(rating)
    };
  }
  
  return progressData;
}

/**
 * Adds user-specific columns to a deck sheet
 * 
 * @param {Sheet} deckSheet - The deck sheet
 * @param {string} username - Username
 * @param {Array} headers - Existing headers
 * @return {Object} Empty progress data
 */
function addUserColumnsToSheet(deckSheet, username, headers) {
  // Determine the last column
  const lastCol = headers.length + 1;
  
  // Add new headers
  deckSheet.getRange(1, lastCol, 1, 3).setValues([[
    username + '_Rating',
    username + '_LastReview',
    username + '_NextDue'
  ]]);
  
  // Return empty progress data
  return {};
}

/**
 * Calculates the interval for spaced repetition based on rating
 * 
 * @param {number} rating - The rating (0-3)
 * @return {number} Interval in days
 */
function calculateInterval(rating) {
  // Simple interval calculation:
  // 0 (Again): 1 day
  // 1 (Hard): 3 days
  // 2 (Good): 7 days
  // 3 (Easy): 14 days
  const intervals = [1, 3, 7, 14];
  return intervals[rating] || 1;
}

/**
 * Processes cards with user progress data
 * 
 * @param {Array} cards - Array of flashcard objects
 * @param {Object} progressData - User progress data
 * @return {Array} Processed cards with progress info
 */
function processCardsWithProgress(cards, progressData) {
  const now = new Date();
  
  return cards.map(card => {
    const progress = progressData[card.id] || {
      rating: 0,
      lastReview: null,
      nextDue: null,
      interval: 1
    };
    
    // Determine if card is due
    const isDue = !progress.nextDue || progress.nextDue <= now;
    
    return {
      ...card,
      rating: progress.rating,
      lastReview: progress.lastReview,
      nextDue: progress.nextDue,
      interval: progress.interval,
      isDue: isDue
    };
  });
}

/**
 * Records a user's rating for a card
 * 
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @param {number} rating - Rating (0-3)
 * @return {Object} Result of the operation
 */
function recordCardRating(deckName, cardId, rating) {
  try {
    // Validate rating
    if (rating < 0 || rating > 3) {
      return { success: false, message: 'Invalid rating value' };
    }
    
    // Get the current user
    const user = getCurrentUserInfo();
    if (!user) {
      return { success: false, message: 'User not logged in' };
    }
    
    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);
    
    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found` };
    }
    
    const data = deckSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const idIndex = headers.indexOf('FlashcardID');
    let userRatingIndex = headers.indexOf(user.userName + '_Rating');
    let userDateIndex = headers.indexOf(user.userName + '_LastReview');
    let userDueIndex = headers.indexOf(user.userName + '_NextDue');
    
    // If user columns don't exist, add them
    if (userRatingIndex === -1 || userDateIndex === -1 || userDueIndex === -1) {
      const lastCol = headers.length;
      
      // Add new headers
      deckSheet.getRange(1, lastCol + 1, 1, 3).setValues([[
        user.userName + '_Rating',
        user.userName + '_LastReview',
        user.userName + '_NextDue'
      ]]);
      
      // Update headers array and indices
      headers.push(user.userName + '_Rating', user.userName + '_LastReview', user.userName + '_NextDue');
      userRatingIndex = headers.indexOf(user.userName + '_Rating');
      userDateIndex = headers.indexOf(user.userName + '_LastReview');
      userDueIndex = headers.indexOf(user.userName + '_NextDue');
    }
    
    // Find the card row
    let cardRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRow = i;
        break;
      }
    }
    
    if (cardRow === -1) {
      return { success: false, message: `Card "${cardId}" not found in deck` };
    }
    
    // Calculate the new interval and next due date
    const interval = calculateInterval(rating);
    const now = new Date();
    const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
    
    // Update the sheet
    deckSheet.getRange(cardRow + 1, userRatingIndex + 1).setValue(rating);
    deckSheet.getRange(cardRow + 1, userDateIndex + 1).setValue(now);
    deckSheet.getRange(cardRow + 1, userDueIndex + 1).setValue(nextDue);
    
    return {
      success: true,
      message: 'Rating recorded successfully',
      nextDue: nextDue,
      interval: interval
    };
  } catch (error) {
    Logger.log('Error recording card rating: ' + error.message);
    return { success: false, message: 'Error recording card rating: ' + error.message };
  }
}

/**
 * Gets due cards for a user across all decks
 * 
 * @return {Object} Due cards by deck
 */
function getUserDueCards() {
  try {
    // Get the current user
    const user = getCurrentUserInfo();
    if (!user) {
      return { success: false, message: 'User not logged in' };
    }
    
    // Get all available decks
    const decksResult = getAvailableDecks();
    if (!decksResult.success) {
      return decksResult;
    }
    
    const dueCardsByDeck = {};
    
    // Process each deck
    decksResult.decks.forEach(deckName => {
      const result = getFlashcardsForDeck(deckName);
      if (result.success) {
        dueCardsByDeck[deckName] = {
          totalCards: result.totalCards,
          dueCards: result.dueCards
        };
      }
    });
    
    return {
      success: true,
      decks: decksResult.decks,
      dueCardsByDeck: dueCardsByDeck
    };
  } catch (error) {
    Logger.log('Error getting due cards: ' + error.message);
    return { success: false, message: 'Error getting due cards: ' + error.message };
  }
}

/**
 * Resets a user's progress for a deck
 * 
 * @param {string} deckName - Name of the deck
 * @return {Object} Result of the operation
 */
function resetDeckProgress(deckName) {
  try {
    // Get the current user
    const user = getCurrentUserInfo();
    if (!user) {
      return { success: false, message: 'User not logged in' };
    }
    
    const ss = getDatabaseSpreadsheet();
    const deckSheet = ss.getSheetByName(deckName);
    
    if (!deckSheet) {
      return { success: false, message: `Deck "${deckName}" not found` };
    }
    
    const data = deckSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const userRatingIndex = headers.indexOf(user.userName + '_Rating');
    const userDateIndex = headers.indexOf(user.userName + '_LastReview');
    const userDueIndex = headers.indexOf(user.userName + '_NextDue');
    
    // If user columns don't exist, nothing to reset
    if (userRatingIndex === -1 || userDateIndex === -1 || userDueIndex === -1) {
      return { success: true, message: 'No progress data to reset' };
    }
    
    // Clear the user columns
    const numRows = deckSheet.getLastRow() - 1;  // Excluding header
    if (numRows > 0) {
      deckSheet.getRange(2, userRatingIndex + 1, numRows, 1).clearContent();
      deckSheet.getRange(2, userDateIndex + 1, numRows, 1).clearContent();
      deckSheet.getRange(2, userDueIndex + 1, numRows, 1).clearContent();
    }
    
    return {
      success: true,
      message: 'Deck progress reset successfully'
    };
  } catch (error) {
    Logger.log('Error resetting deck progress: ' + error.message);
    return { success: false, message: 'Error resetting deck progress: ' + error.message };
  }
}