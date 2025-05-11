/**
 * Handle login form submission
 * 
 * @param {Event} event - Form submit event
 */
function handleLogin(event) {
  if (event) {
    event.preventDefault();
  }
  
  const usernameElement = document.getElementById('username');
  const passwordElement = document.getElementById('password');
  
  if (!usernameElement || !passwordElement) {
    handleError('Login form elements not found');
    return;
  }
  
  const username = usernameElement.value;
  const password = passwordElement.value;
  
  if (!username) {
    handleError('Username is required');
    return;
  }
  
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      // Defensive check for null response
      if (!result) {
        hideLoadingIndicator();
        handleError('Server returned an empty response during login');
        return;
      }
      
      if (result.success) {
        // Update app state
        window.app.isLoggedIn = true;
        window.app.isAdmin = result.user && result.user.isAdmin;
        window.app.userName = result.user ? result.user.userName : '';
        
        // Show user info
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
          userInfo.style.display = 'flex';
          const welcomeSpan = userInfo.querySelector('span');
          if (welcomeSpan) {
            welcomeSpan.textContent = `Welcome, ${window.app.userName}`;
          }
        }
        
        // Show admin button if applicable
        const adminBtn = document.getElementById('adminPanelBtn');
        if (adminBtn) {
          adminBtn.style.display = window.app.isAdmin ? 'block' : 'none';
        }
        
        // Load deck list
        loadDeckList();
        
        // Show success message
        showSuccess('Login successful');
      } else if (result.needsInit) {
        // App needs initialization
        showInitForm();
      } else {
        // Login failed
        handleError(result.message || 'Login failed');
      }
      
      hideLoadingIndicator();
    })
    .withFailureHandler(function(error) {
      hideLoadingIndicator();
      handleError('Login error: ' + (error ? error.toString() : 'Unknown error'));
      
      // Clear password field for security
      if (passwordElement) {
        passwordElement.value = '';
      }
    })
    .authenticateUser(username, password);
}

/**
 * Toggle password visibility
 */
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const icon = document.getElementById('passwordToggle');
  
  if (!passwordInput || !icon) {
    console.error('Password toggle elements not found');
    return;
  }
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    passwordInput.type = 'password';
    icon.textContent = 'visibility';
  }
}

/**
 * Show app initialization form
 */
function showInitForm() {
  const contentArea = document.getElementById('appContent');
  if (!contentArea) {
    console.error('Content area not found');
    return;
  }
  
  contentArea.innerHTML = `
    <div class="card">
      <div class="card-title">Initialize Flashcard App</div>
      <p>This app needs to be initialized before first use.</p>
      <form id="initForm" class="form">
        <div class="form-group">
          <label for="databaseName" class="form-label">Database Name</label>
          <input type="text" id="databaseName" class="form-control" value="Flashcard App Database" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn">Initialize App</button>
        </div>
      </form>
    </div>
  `;
  
  // Add event listener to the form
  const initForm = document.getElementById('initForm');
  if (initForm) {
    initForm.addEventListener('submit', handleInitApp);
  } else {
    console.error('Init form not found after rendering');
  }
}

/**
 * Handle app initialization
 * 
 * @param {Event} event - Form submit event
 */
function handleInitApp(event) {
  if (event) {
    event.preventDefault();
  }
  
  const databaseNameElement = document.getElementById('databaseName');
  if (!databaseNameElement) {
    handleError('Database name input not found');
    return;
  }
  
  const databaseName = databaseNameElement.value || 'Flashcard App Database';
  
  showLoadingIndicator();
  
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result) {
        hideLoadingIndicator();
        handleError('Server returned an empty response during initialization');
        return;
      }
      
      if (result.success) {
        showSuccess('App initialized successfully');
        setTimeout(() => {
          showLoginForm();
        }, 1500);
      } else {
        handleError(result.message || 'App initialization failed');
      }
      
      hideLoadingIndicator();
    })
    .withFailureHandler(function(error) {
      hideLoadingIndicator();
      handleError('Initialization error: ' + (error ? error.toString() : 'Unknown error'));
    })
    .initializeApp({ databaseName: databaseName });
}