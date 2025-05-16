/**
 * Database Management Module for Flashcard App
 * Handles interactions with the Google Spreadsheet acting as the database.
 */

/**
 * Creates a new Google Spreadsheet to serve as the database.
 * This is typically called during app initialization.
 *
 * @param {string} name - Name for the new spreadsheet (e.g., "Flashcard App Database")
 * @return {Object} {id: string, url: string, spreadsheet: Spreadsheet}
 */
function createDatabaseSpreadsheet(name) {
  const spreadsheet = SpreadsheetApp.create(name);
  const id = spreadsheet.getId();
  const url = spreadsheet.getUrl();

  // Add the active user (creator) as an editor for immediate access
  try {
    const activeUserEmail = Session.getActiveUser().getEmail();
    if (activeUserEmail) { 
      DriveApp.getFileById(id).addEditor(activeUserEmail);
    }
  } catch (e) {
    Logger.log(`Could not automatically add editor ${Session.getActiveUser().getEmail()} to spreadsheet ${id}: ${e.message}. Manual sharing might be needed.`);
  }
  
  Logger.log(`Database spreadsheet created: Name='${name}', ID='${id}'`);
  return { id, url, spreadsheet };
}

/**
 * Initializes the database structure with required sheets and basic data.
 * Called once when the application is first set up.
 *
 * @param {string} spreadsheetId - The ID of the database spreadsheet
 */
function initializeDatabaseStructure(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);

  let configSheet = ss.getSheetByName('Sheet1');
  if (configSheet) {
    configSheet.setName('Config');
  } else {
    configSheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  }
  setupConfigSheet(configSheet);

  const classesSheet = ss.getSheetByName('Classes') || ss.insertSheet('Classes');
  setupClassesSheet(classesSheet);
  
  Logger.log(`Database structure initialized for spreadsheet ID: ${spreadsheetId}`);
}

/**
 * Sets up the 'Config' sheet with columns for user data and an initial admin user.
 *
 * @param {Sheet} sheet - The 'Config' sheet object
 */
function setupConfigSheet(sheet) {
  sheet.clearContents(); 
  // Corrected headers for user configuration
  const headers = [
    'StudentFirst',   // Column A
    'StudentLast',    // Column B
    'UserName',       // Column C
    'Password',       // Column D
    'IsAdmin',        // Column E (Boolean - Checkbox preferred)
    'DateCreated',    // Column F (Date user account created)
    'LastLogin',      // Column G (Timestamp of last login)
    'PreferredDeck',  // Column H (Optional: User's preferred deck)
    'SessionDuration' // Column I (Optional: User's session duration preference in minutes)
  ];
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');
  
  // Set 'IsAdmin' column to be checkboxes for new rows
  // This is a bit tricky to apply dynamically to all future rows, but for the header row
  // and potentially the first data row, we can set data validation.
  // For simplicity, admins would manually format this column as Checkbox or the code relies on true/false values.
  // To ensure the 'IsAdmin' column is treated as boolean, we explicitly handle true/false strings/values.
  // For existing sheets, users might need to format this column as Checkbox.

  // Default admin user data aligned with new headers
  const adminUser = [
    'Admin',          // StudentFirst
    'User',           // StudentLast
    'admin',          // UserName
    'password',       // Password
    true,             // IsAdmin (true for boolean, or 'TRUE' for string)
    new Date(),       // DateCreated
    null,             // LastLogin (initially null or empty)
    '',               // PreferredDeck
    '60'              // SessionDuration
  ];
  sheet.getRange(2, 1, 1, adminUser.length).setValues([adminUser]);
  // Make the IsAdmin cell for the admin user a checkbox if possible
  try {
      sheet.getRange(2, headers.indexOf('IsAdmin') + 1).insertCheckboxes();
  } catch (e) {
      Logger.log("Could not set 'IsAdmin' cell as checkbox for default admin, will use TRUE/FALSE values: " + e.message);
  }


  headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));
  Logger.log("'Config' sheet setup complete with default admin user and corrected headers.");
}

/**
 * Sets up the 'Classes' sheet with columns for class management.
 *
 * @param {Sheet} sheet - The 'Classes' sheet object
 */
function setupClassesSheet(sheet) {
  sheet.clearContents();
  const headers = ['ClassName', 'ClassID', 'TeacherUsername', 'StudentUsernames', 'AssignedDecks'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');

  const sampleClass = [
    'Sample Class 101',
    `class_${Utilities.getUuid().substring(0,6)}`,
    'admin', 
    JSON.stringify([]), 
    JSON.stringify(['Sample_Deck']) 
  ];
  sheet.getRange(2, 1, 1, sampleClass.length).setValues([sampleClass]);
  
  headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));
  Logger.log("'Classes' sheet setup complete.");
}

/**
 * Creates a sample flashcard deck named 'Sample_Deck'.
 * Ensures StudyConfig is the 8th column (H).
 * @param {string} spreadsheetId - The ID of the database spreadsheet
 */
function createSampleDeck(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const deckName = 'Sample_Deck';
  
  let deckSheet = ss.getSheetByName(deckName);
  if (deckSheet) {
    deckSheet.clearContents(); 
  } else {
    deckSheet = ss.insertSheet(deckName);
  }

  // Ensure StudyConfig is the 8th column (H)
  const headers = [
    'FlashcardID',    // Column A
    'FlashcardSideA', // Column B
    'FlashcardSideB', // Column C
    'FlashcardSideC', // Column D
    'Tags',           // Column E
    'DateCreated',    // Column F
    'CreatedBy',      // Column G
    'StudyConfig'     // Column H
  ];
  deckSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');

  const defaultStudyConfig = JSON.stringify({ showSideB: true, showSideC: true, autoplayAudio: false });
  const sampleCards = [
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is the capital of France?', 'Paris', 'Hint: European city', 'geography,europe', new Date(), 'admin', defaultStudyConfig],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is 2 + 2?', '4', '', 'math,basics', new Date(), 'admin', defaultStudyConfig],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Famous English playwright', 'literature,classics', new Date(), 'admin', defaultStudyConfig],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is H₂O (H2O)?', 'Water', 'Chemical formula', 'science,chemistry', new Date(), 'admin', defaultStudyConfig],
    [`card_${Utilities.getUuid().substring(0,8)}`, 'What is the largest planet in our solar system?', 'Jupiter', 'A gas giant', 'science,astronomy', new Date(), 'admin', defaultStudyConfig]
  ];
  if (sampleCards.length > 0) {
    // Ensure sampleCards rows match the number of headers
    const dataToWrite = sampleCards.map(cardRow => {
        if (cardRow.length < headers.length) {
            // Pad row if it's shorter than headers (e.g. if StudyConfig was missing)
            return cardRow.concat(Array(headers.length - cardRow.length).fill(''));
        }
        return cardRow.slice(0, headers.length); // Ensure it's not longer
    });
    deckSheet.getRange(2, 1, dataToWrite.length, headers.length).setValues(dataToWrite);
  }
  
  headers.forEach((_, i) => deckSheet.autoResizeColumn(i + 1));
  Logger.log(`'${deckName}' sheet setup complete with sample cards and StudyConfig as column H.`);
}

/**
 * Retrieves the database spreadsheet object.
 * Throws an error if the database ID is not configured.
 *
 * @return {Spreadsheet} The database spreadsheet
 * @throws {Error} If databaseId script property is not set.
 */
function getDatabaseSpreadsheet() {
  const databaseId = getScriptProperty('databaseId'); 
  if (!databaseId) {
    Logger.log("CRITICAL: Database ID script property not found.");
    throw new Error('Database not initialized. Please run initialization or check Script Properties.');
  }
  try {
    return SpreadsheetApp.openById(databaseId);
  } catch (e) {
    Logger.log(`CRITICAL: Failed to open database spreadsheet with ID '${databaseId}'. Error: ${e.message}`);
    throw new Error(`Failed to access database. Ensure spreadsheet ID '${databaseId}' is valid and accessible. Original error: ${e.message}`);
  }
}

/**
 * Gets a list of all available deck names (sheet names).
 *
 * @param {boolean} excludeSystemSheets - If true, 'Config' and 'Classes' sheets are excluded.
 * @return {Object} {success: boolean, decks?: Array<string>, message?: string}
 */
function getAvailableDecks(excludeSystemSheets = true) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheets = ss.getSheets();
    const systemSheets = ['Config', 'Classes'];

    const decks = sheets
      .map(sheet => sheet.getName())
      .filter(name => !excludeSystemSheets || !systemSheets.includes(name));

    return {
      success: true,
      decks: decks
    };
  } catch (error) {
    Logger.log(`Error in getAvailableDecks: ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error getting available decks: ${error.message}` };
  }
}

/**
 * Retrieves all flashcards from a specific deck sheet.
 * Returns full card objects including all defined columns.
 * Ensures all returned values are JSON-serializable primitives or arrays of primitives.
 *
 * @param {string} deckName - The name of the deck (sheet name)
 * @return {Array<Object>} Array of flashcard objects. Each object's keys are the header names.
 * @throws {Error} If deck not found or required columns are missing.
 */
function getDeckFlashcards(deckName) {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(deckName);

  if (!sheet) {
    Logger.log(`Deck not found: ${deckName}`);
    throw new Error(`Deck "${deckName}" not found.`);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 1) { 
      Logger.log(`Deck "${deckName}" is empty or has no headers.`);
      return []; 
  }
  const headers = data[0].map(h => String(h).trim()); 

  const requiredColumns = ['FlashcardID', 'FlashcardSideA', 'FlashcardSideB'];
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      Logger.log(`Deck "${deckName}" is missing required column: ${col}`);
      throw new Error(`Deck "${deckName}" is missing required column: "${col}". Please check sheet headers.`);
    }
  }

  const flashcards = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const card = {};
    let hasEssentialData = true; 

    headers.forEach((header, index) => {
      let value = row[index];
      // Ensure value is JSON serializable: convert Dates to ISO strings, others to string/number/boolean
      if (value instanceof Date) {
        card[header] = value.toISOString();
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
        card[header] = value;
      } else {
        // For any other complex types or if unsure, convert to string.
        card[header] = value != null ? String(value) : null;
      }

      if (requiredColumns.includes(header) && (card[header] === null || String(card[header]).trim() === '')) {
          if (header === 'FlashcardID') hasEssentialData = false; 
      }
    });
    
    if (hasEssentialData && card.FlashcardID && card.FlashcardSideA && card.FlashcardSideB) {
        if (headers.includes('Tags') && typeof card['Tags'] === 'string') { 
            card['Tags'] = card['Tags'].split(',').map(tag => tag.trim()).filter(tag => tag);
        } else if (headers.includes('Tags')) { // If Tags column exists but value isn't a string (e.g. null or already processed)
            if (Array.isArray(card['Tags'])) {
              // Value is already an array, do nothing or ensure elements are strings if necessary
            } else {
              card['Tags'] = []; 
            }
        }
        flashcards.push(card);
    } else {
        Logger.log(`Skipping row ${i+1} in deck "${deckName}" due to missing essential data (ID, SideA, or SideB). Card data: ${JSON.stringify(card)}`);
    }
  }
  return flashcards;
}


// server/Database.js - Update the getUserData function

/**
 * Retrieves user data from the 'Config' sheet based on username.
 *
 * @param {string} username - Username to look up (case-insensitive)
 * @return {Object|null} User data object or null if not found. Includes Password for authentication.
 */
function getUserData(username) {
  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet) {
        Logger.log("CRITICAL: 'Config' sheet not found during getUserData.");
        return null;
    }

    const data = configSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const usernameIndex = headers.indexOf('UserName');
    const isAdminIndex = headers.indexOf('IsAdmin');
    
    // Debug log to see if IsAdmin column exists
    Logger.log(`getUserData: Looking for user "${username}". Headers: ${JSON.stringify(headers)}. UserName column index: ${usernameIndex}, IsAdmin column index: ${isAdminIndex}`);

    if (usernameIndex === -1) {
      Logger.log("CRITICAL: 'UserName' column not found in 'Config' sheet.");
      return null; 
    }

    const lowerCaseUsername = username.toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[usernameIndex] && String(row[usernameIndex]).toLowerCase() === lowerCaseUsername) {
        // Found the user
        let isAdminValue = false; // Default to false
        
        if (isAdminIndex !== -1) {
          try {
            const isAdminCell = configSheet.getRange(i + 1, isAdminIndex + 1);
            const cellValue = isAdminCell.getValue();
            // Checkbox state
            const isChecked = isAdminCell.isChecked(); 
            if (isChecked !== null) { // isChecked() returns true/false, or null if not a checkbox
                isAdminValue = isChecked;
            } else { // Fallback to value if not a checkbox or isChecked() fails
                isAdminValue = cellValue === true || String(cellValue).toUpperCase() === 'TRUE';
            }
            Logger.log(`Raw IsAdmin cell value for ${username}: ${cellValue}; isChecked: ${isChecked}; Determined isAdminValue: ${isAdminValue}`);
          } catch (checkboxErr) {
            Logger.log(`Error getting checkbox state for user ${username}: ${checkboxErr.message}. Falling back to direct value check.`);
            // Fallback to direct value check from 'data' array if getRange/isChecked fails
            isAdminValue = row[isAdminIndex] === true || 
                         String(row[isAdminIndex]).toUpperCase() === 'TRUE';
          }
        } else {
            Logger.log(`IsAdmin column not found in Config. Defaulting ${username} to non-admin.`);
        }
        
        // Build user object manually
        const user = {};
        headers.forEach((header, index) => {
            if (header === 'IsAdmin') {
              user[header] = isAdminValue; // Use our determined boolean value
            } else {
              let value = row[index];
              if (value instanceof Date) {
                  user[header] = value.toISOString();
              } else {
                  user[header] = value;
              }
            }
        });
        
        Logger.log(`User data retrieved for ${username}: ${JSON.stringify(user)}`);
        return user;
      }
    }
    Logger.log(`User ${username} not found in Config sheet.`);
    return null; // User not found
  } catch (error) {
    Logger.log(`Error in getUserData for "${username}": ${error.message}\nStack: ${error.stack}`);
    return null;
  }
}

/**
 * Updates the 'LastLogin' timestamp for a specified user in the 'Config' sheet.
 *
 * @param {string} username - The username (case-insensitive)
 */
function updateUserLastLogin(username) {
  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
     if (!configSheet) {
        Logger.log("CRITICAL: 'Config' sheet not found during updateUserLastLogin.");
        return;
    }

    const data = configSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const usernameIndex = headers.indexOf('UserName');
    const lastLoginIndex = headers.indexOf('LastLogin');

    if (usernameIndex === -1 || lastLoginIndex === -1) {
      Logger.log("CRITICAL: 'UserName' or 'LastLogin' column not found in 'Config' sheet.");
      return; 
    }

    const lowerCaseUsername = username.toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameIndex] && String(data[i][usernameIndex]).toLowerCase() === lowerCaseUsername) {
        configSheet.getRange(i + 1, lastLoginIndex + 1).setValue(new Date());
        Logger.log(`Updated LastLogin for user: ${username}`);
        return;
      }
    }
    Logger.log(`User not found for LastLogin update: ${username}`);
  } catch (error) {
    Logger.log(`Error in updateUserLastLogin for "${username}": ${error.message}\nStack: ${error.stack}`);
  }
}

/**
 * Adds a new user to the 'Config' sheet.
 * Intended for admin use; direct calls should be secured.
 *
 * @param {Object} userData - User data object. Must include UserName, Password.
 *                            Optional: StudentFirst, StudentLast, IsAdmin.
 * @return {Object} {success: boolean, message: string}
 */
function addUser(userData) {
  // Admin check should be done in the calling function (e.g., from AdminTools.js)
  // For direct calls from server-side not triggered by client, this is okay.
  // If called from client via google.script.run, the client-facing server function must do the check.

  if (!userData || !userData.UserName || !userData.Password) {
    return { success: false, message: "UserName and Password are required to add a new user." };
  }

  try {
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet) {
        return { success: false, message: "CRITICAL: 'Config' sheet not found." };
    }

    const data = configSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim()); // These are the corrected user config headers
    const usernameIndex = headers.indexOf('UserName');

    const userExists = data.slice(1).some(row =>
      row[usernameIndex] && String(row[usernameIndex]).toLowerCase() === userData.UserName.toLowerCase()
    );

    if (userExists) {
      return { success: false, message: `User "${userData.UserName}" already exists.` };
    }

    const newRowValues = headers.map(header => {
      switch(header) {
        case 'StudentFirst': return userData.StudentFirst || '';
        case 'StudentLast': return userData.StudentLast || '';
        case 'UserName': return userData.UserName;
        case 'Password': return userData.Password; 
        case 'IsAdmin': return userData.IsAdmin === true || String(userData.IsAdmin).toUpperCase() === 'TRUE'; // Store as boolean
        case 'DateCreated': return new Date(); 
        case 'LastLogin': return null; 
        case 'PreferredDeck': return userData.PreferredDeck || '';
        case 'SessionDuration': return userData.SessionDuration || '60'; // Default to '60' if not provided
        default: return ''; // For any other unexpected headers
      }
    });
    
    const newRowIndex = configSheet.getLastRow() + 1;
    configSheet.getRange(newRowIndex, 1, 1, newRowValues.length).setValues([newRowValues]);

    // Attempt to format 'IsAdmin' cell as checkbox for the new user
    const isAdminColIndex = headers.indexOf('IsAdmin');
    if (isAdminColIndex !== -1) {
        try {
            configSheet.getRange(newRowIndex, isAdminColIndex + 1).insertCheckboxes();
        } catch (e) {
            Logger.log(`Could not set 'IsAdmin' cell as checkbox for new user ${userData.UserName}: ${e.message}`);
        }
    }

    Logger.log(`New user added: ${userData.UserName}`);
    return { success: true, message: `User "${userData.UserName}" added successfully.` };

  } catch (error) {
    Logger.log(`Error in addUser for "${userData.UserName}": ${error.message}\nStack: ${error.stack}`);
    return { success: false, message: `Server error adding user: ${error.message}` };
  }
}

// Add this to server/Database.js - New function to get admin status directly

function isUserAdminInSheet(username) {
  return getIsUserAdmin(username);
}


/**
 * Improved admin status verification that accounts for column name variations
 * and checkbox state for 'IsAdmin' column in the 'Config' sheet.
 * 
 * @param {string} username - The username to check
 * @return {boolean} True if the user is an admin, false otherwise
 */
function getIsUserAdmin(username) {
  try {
    if (!username || typeof username !== 'string') {
      Logger.log("getIsUserAdmin: Invalid username parameter (null, undefined, or not a string)");
      return false;
    }
    
    const ss = getDatabaseSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    
    if (!configSheet) {
      Logger.log("getIsUserAdmin: Config sheet not found");
      return false;
    }
    
    const data = configSheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log("getIsUserAdmin: Config sheet has no data or only headers");
      return false;
    }
    
    const headers = data[0].map(h => String(h).trim());
    Logger.log("getIsUserAdmin: Config sheet headers: " + JSON.stringify(headers));
    
    let usernameIndex = headers.findIndex(h => h.toLowerCase() === 'username');
    let isAdminIndex = headers.findIndex(h => h.toLowerCase() === 'isadmin');
        
    Logger.log(`getIsUserAdmin: Column indices - UserName: ${usernameIndex}, IsAdmin: ${isAdminIndex}`);
    
    if (usernameIndex === -1) {
      Logger.log("getIsUserAdmin: 'UserName' column not found in Config sheet headers.");
      return false; // Cannot identify user without UserName column
    }
    
    // If IsAdmin column is not found, no user can be admin unless a special fallback for 'admin' user.
    if (isAdminIndex === -1) {
      Logger.log("getIsUserAdmin: 'IsAdmin' column not found in Config sheet headers.");
      if (username.toLowerCase() === 'admin') {
          Logger.log("getIsUserAdmin: 'IsAdmin' column missing, but username is 'admin'. Defaulting 'admin' to admin role as a fallback.");
          return true; // Fallback for 'admin' user if IsAdmin column is missing
      }
      return false; // Other users cannot be admin if IsAdmin column is missing
    }
    
    const lowerCaseUsername = username.toLowerCase();
    for (let i = 1; i < data.length; i++) { // Start from 1 to skip header row
      const row = data[i];
      const currentUsername = String(row[usernameIndex] || "").toLowerCase();
      
      if (currentUsername === lowerCaseUsername) {
        // Found the user, now check IsAdmin status
        let isAdminStatus = false;
        const isAdminCell = configSheet.getRange(i + 1, isAdminIndex + 1); // Sheet rows are 1-indexed, i is 0-indexed for data array
        
        try {
          const isChecked = isAdminCell.isChecked();
          if (isChecked !== null) { // isChecked() returns true/false for checkboxes, null otherwise
            isAdminStatus = isChecked;
            Logger.log(`getIsUserAdmin: User "${username}", IsAdmin cell is checkbox, checked: ${isAdminStatus}`);
          } else {
            // Cell is not a checkbox or isChecked() is not supported/failed, fall back to value
            const cellValue = isAdminCell.getValue();
            isAdminStatus = cellValue === true || String(cellValue).toUpperCase() === 'TRUE';
            Logger.log(`getIsUserAdmin: User "${username}", IsAdmin cell not checkbox or isChecked failed. Value: "${cellValue}", Determined: ${isAdminStatus}`);
          }
        } catch (e) {
          // Error accessing cell as checkbox, fallback to raw data value
          Logger.log(`getIsUserAdmin: Error checking IsAdmin cell for "${username}": ${e.message}. Falling back to raw data value.`);
          const rawValue = row[isAdminIndex];
          isAdminStatus = rawValue === true || String(rawValue).toUpperCase() === 'TRUE';
        }
        
        Logger.log(`getIsUserAdmin: Final admin status for "${username}": ${isAdminStatus}`);
        return isAdminStatus;
      }
    }
    
    Logger.log(`getIsUserAdmin: User "${username}" not found in Config sheet.`);
    return false;
  } catch (error) {
    Logger.log(`CRITICAL Error in getIsUserAdmin for "${username}": ${error.message}\nStack: ${error.stack}`);
    return false; // Default to false on error
  }
}