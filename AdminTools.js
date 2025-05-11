/**
 * Admin Tools Module for Flashcard App
 * Provides admin-specific functionality for managing decks and cards
 */

/**
 * Checks if the current user is an admin
 * 
 * @return {boolean} True if admin, false otherwise
 */
function isUserAdmin() {
  const session = getUserSession();
  return session && session.isValid && session.isAdmin;
}

/**
 * Gets admin access information
 * 
 * @return {Object} Admin access information
 */
function getAdminAccess() {
  const isAdmin = isUserAdmin();
  
  return {
    success: true,
    isAdmin: isAdmin,
    message: isAdmin ? 'Admin access granted' : 'Admin access required'
  };
}

/**
 * Creates a new flashcard deck
 * 
 * @param {string} deckName - Name for the new deck
 * @return {Object} Result of operation
 */
function createDeck(deckName) {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can create decks' };
    }
    
    // Validate deck name
    if (!deckName || deckName.trim() === '') {
      return { success: false, message: 'Deck name is required' };
    }
    
    // Clean up the deck name
    const cleanDeckName = deckName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    
    const ss = getDatabaseSpreadsheet();
    
    // Check if deck already exists
    const existingSheet = ss.getSheetByName(cleanDeckName);
    if (existingSheet) {
      return { success: false, message: `Deck "${cleanDeckName}" already exists` };
    }
    
    // Create the deck sheet
    const newSheet = ss.insertSheet(cleanDeckName);
    
    // Set up headers
    const headers = [
      'FlashcardID', 'FlashcardSideA', 'FlashcardSideB', 'FlashcardSideC',
      'Tags', 'DateCreated', 'CreatedBy'
    ];
    
    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format the header row
    newSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f3f3f3');
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      newSheet.autoResizeColumn(i);
    }
    
    return {
      success: true,
      message: `Deck "${cleanDeckName}" created successfully`
    };
  } catch (error) {
    Logger.log(`Error creating deck: ${error.message}`);
    return { success: false, message: `Error creating deck: ${error.message}` };
  }
}

/**
 * Adds a new flashcard to a deck
 * 
 * @param {string} deckName - Name of the deck
 * @param {Object} cardData - Card data (sideA, sideB, sideC, tags)
 * @return {Object} Result of operation
 */
function addFlashcard(deckName, cardData) {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can add cards' };
    }
    
    // Validate card data
    if (!cardData.sideA || cardData.sideA.trim() === '') {
      return { success: false, message: 'Card side A is required' };
    }
    
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found` };
    }
    
    // Generate card ID
    const cardId = 'card' + Utilities.getUuid().substring(0, 8);
    
    // Get current user
    const user = getCurrentUserInfo();
    
    // Prepare the card data
    const newCard = [
      cardId,
      cardData.sideA.trim(),
      cardData.sideB ? cardData.sideB.trim() : '',
      cardData.sideC ? cardData.sideC.trim() : '',
      cardData.tags ? cardData.tags.trim() : '',
      new Date(),
      user.userName
    ];
    
    // Append the card
    sheet.appendRow(newCard);
    
    return {
      success: true,
      message: 'Flashcard added successfully',
      cardId: cardId
    };
  } catch (error) {
    Logger.log(`Error adding flashcard: ${error.message}`);
    return { success: false, message: `Error adding flashcard: ${error.message}` };
  }
}

/**
 * Gets a list of all users for admin view
 * 
 * @return {Object} List of users
 */
function getUsers() {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can view users' };
    }
    
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    const data = configSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Extract user data
    const users = data.slice(1).map(row => {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = row[index];
      });
      return user;
    });
    
    return {
      success: true,
      users: users
    };
  } catch (error) {
    Logger.log(`Error getting users: ${error.message}`);
    return { success: false, message: `Error getting users: ${error.message}` };
  }
}

/**
 * Deletes a flashcard from a deck
 * 
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @return {Object} Result of operation
 */
function deleteFlashcard(deckName, cardId) {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can delete cards' };
    }
    
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found` };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the ID column index
    const idIndex = headers.indexOf('FlashcardID');
    if (idIndex === -1) {
      return { success: false, message: 'FlashcardID column not found' };
    }
    
    // Find the card row
    let cardRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRow = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }
    
    if (cardRow === -1) {
      return { success: false, message: `Card "${cardId}" not found in deck` };
    }
    
    // Delete the row
    sheet.deleteRow(cardRow);
    
    return {
      success: true,
      message: 'Flashcard deleted successfully'
    };
  } catch (error) {
    Logger.log(`Error deleting flashcard: ${error.message}`);
    return { success: false, message: `Error deleting flashcard: ${error.message}` };
  }
}

/**
 * Updates an existing flashcard
 * 
 * @param {string} deckName - Name of the deck
 * @param {string} cardId - ID of the flashcard
 * @param {Object} cardData - Updated card data
 * @return {Object} Result of operation
 */
function updateFlashcard(deckName, cardId, cardData) {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can update cards' };
    }
    
    // Validate card data
    if (!cardData.sideA || cardData.sideA.trim() === '') {
      return { success: false, message: 'Card side A is required' };
    }
    
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found` };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const idIndex = headers.indexOf('FlashcardID');
    const sideAIndex = headers.indexOf('FlashcardSideA');
    const sideBIndex = headers.indexOf('FlashcardSideB');
    const sideCIndex = headers.indexOf('FlashcardSideC');
    const tagsIndex = headers.indexOf('Tags');
    
    if (idIndex === -1 || sideAIndex === -1 || sideBIndex === -1) {
      return { success: false, message: 'Required columns not found' };
    }
    
    // Find the card row
    let cardRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === cardId) {
        cardRow = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }
    
    if (cardRow === -1) {
      return { success: false, message: `Card "${cardId}" not found in deck` };
    }
    
    // Update the card
    sheet.getRange(cardRow, sideAIndex + 1).setValue(cardData.sideA.trim());
    sheet.getRange(cardRow, sideBIndex + 1).setValue(cardData.sideB ? cardData.sideB.trim() : '');
    
    if (sideCIndex !== -1) {
      sheet.getRange(cardRow, sideCIndex + 1).setValue(cardData.sideC ? cardData.sideC.trim() : '');
    }
    
    if (tagsIndex !== -1) {
      sheet.getRange(cardRow, tagsIndex + 1).setValue(cardData.tags ? cardData.tags.trim() : '');
    }
    
    return {
      success: true,
      message: 'Flashcard updated successfully'
    };
  } catch (error) {
    Logger.log(`Error updating flashcard: ${error.message}`);
    return { success: false, message: `Error updating flashcard: ${error.message}` };
  }
}

/**
 * Deletes an entire deck
 * 
 * @param {string} deckName - Name of the deck to delete
 * @return {Object} Result of operation
 */
function deleteDeck(deckName) {
  try {
    // Check admin permissions
    if (!isUserAdmin()) {
      return { success: false, message: 'Only admins can delete decks' };
    }
    
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(deckName);
    
    if (!sheet) {
      return { success: false, message: `Deck "${deckName}" not found` };
    }
    
    // Check if it's a system sheet
    const systemSheets = ['Config', 'Classes'];
    if (systemSheets.includes(deckName)) {
      return { success: false, message: `Cannot delete system sheet "${deckName}"` };
    }
    
    // Delete the sheet
    ss.deleteSheet(sheet);
    
    return {
      success: true,
      message: `Deck "${deckName}" deleted successfully`
    };
  } catch (error) {
    Logger.log(`Error deleting deck: ${error.message}`);
    return { success: false, message: `Error deleting deck: ${error.message}` };
  }
}