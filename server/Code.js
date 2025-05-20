// Main Apps Script file for server-side functions

// Access script properties to get the Pexels API key
function getPexelsApiKey() {
  return PropertiesService.getScriptProperties().getProperty('PEXELS_API_KEY');
}

// Serve the HTML content
function doGet() {
  return HtmlService.createHtmlOutputFromFile('client/Index')
    .setTitle('Flashcard App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Function to search for an image using Pexels API
function searchPexelsImage(query) {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "No API key found. Please add PEXELS_API_KEY to script properties."
    };
  }

  try {
    // Make request to Pexels API
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': apiKey
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    // Check if photos were found
    if (data.photos && data.photos.length > 0) {
      return {
        success: true,
        imageUrl: data.photos[0].src.medium
      };
    } else {
      // No images found for the query
      return {
        success: false,
        error: "No images found for this word"
      };
    }
  } catch (error) {
    // Handle API or connection errors
    return {
      success: false,
      error: "Error fetching image: " + error.toString()
    };
  }
}

// Save flashcards to user properties (server-side storage)
function saveFlashcards(flashcards) {
  PropertiesService.getUserProperties().setProperty(
    'savedFlashcards', 
    JSON.stringify(flashcards)
  );
  return true;
}

// Load flashcards from user properties (server-side storage)
function loadFlashcards() {
  const savedData = PropertiesService.getUserProperties().getProperty('savedFlashcards');
  if (savedData) {
    return JSON.parse(savedData);
  }
  
  // Return default flashcards if none are saved
  return [
    { word: "Apple", image: "https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg" },
    { word: "Banana", image: "https://images.pexels.com/photos/1093038/pexels-photo-1093038.jpeg" },
    { word: "Cat", image: "https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg" },
    { word: "Dog", image: "https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg" },
    { word: "Elephant", image: "https://images.pexels.com/photos/66898/elephant-cub-tsavo-kenya-66898.jpeg" }
  ];
}