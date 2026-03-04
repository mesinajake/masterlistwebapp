# Go Implementation (Gin)

## Dependencies

```bash
go mod init lark-sso-demo
go get github.com/gin-gonic/gin
go get github.com/gin-contrib/sessions
go get github.com/gin-contrib/sessions/cookie
go get github.com/joho/godotenv
go get golang.org/x/oauth2
```

## Complete Example

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	_ "github.com/joho/godotenv/autoload"
	"golang.org/x/oauth2"
)

var oauthEndpoint = oauth2.Endpoint{
	AuthURL:  "https://accounts.larksuite.com/open-apis/authen/v1/authorize",
	TokenURL: "https://open.larksuite.com/open-apis/authen/v2/oauth/token",
}

var oauthConfig *oauth2.Config

func init() {
	rand.Seed(time.Now().UnixNano())
	
	oauthConfig = &oauth2.Config{
		ClientID:     os.Getenv("LARK_APP_ID"),
		ClientSecret: os.Getenv("LARK_APP_SECRET"),
		RedirectURL:  os.Getenv("REDIRECT_URI"),
		Endpoint:     oauthEndpoint,
		Scopes:       []string{"offline_access"}, // Add more scopes as needed
	}
	
	if oauthConfig.RedirectURL == "" {
		oauthConfig.RedirectURL = "http://localhost:8080/callback"
	}
}

func main() {
	r := gin.Default()

	// Session configuration - use secure secret in production
	secretKey := os.Getenv("SECRET_KEY")
	if secretKey == "" {
		secretKey = "change-me-in-production"
	}
	store := cookie.NewStore([]byte(secretKey))
	r.Use(sessions.Sessions("lark-session", store))

	// Routes
	r.GET("/", indexHandler)
	r.GET("/login", loginHandler)
	r.GET("/callback", callbackHandler)
	r.GET("/logout", logoutHandler)
	r.GET("/refresh", refreshHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server running on http://localhost:%s\n", port)
	log.Fatal(r.Run(":" + port))
}

func indexHandler(c *gin.Context) {
	session := sessions.Default(c)
	c.Header("Content-Type", "text/html; charset=utf-8")

	userName := ""
	if user := session.Get("user"); user != nil {
		userName = user.(string)
	}

	if userName != "" {
		html := fmt.Sprintf(`
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; 
					       display: flex; justify-content: center; align-items: center; height: 100vh; }
					.container { text-align: center; background: #fff; padding: 30px; 
					             border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
					a { padding: 10px 20px; font-size: 16px; color: #fff; background: #007bff; 
					    border-radius: 5px; text-decoration: none; }
					a:hover { background: #0056b3; }
				</style>
			</head>
			<body>
				<div class="container">
					<h2>Welcome, %s!</h2>
					<p>You are logged in via Lark SSO.</p>
					<a href="/logout">Logout</a>
				</div>
			</body>
			</html>`, userName)
		c.String(http.StatusOK, html)
	} else {
		html := `
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; 
					       display: flex; justify-content: center; align-items: center; height: 100vh; }
					.container { text-align: center; background: #fff; padding: 30px; 
					             border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
					a { padding: 10px 20px; font-size: 16px; color: #fff; background: #007bff; 
					    border-radius: 5px; text-decoration: none; }
					a:hover { background: #0056b3; }
				</style>
			</head>
			<body>
				<div class="container">
					<h2>Lark SSO Login Demo</h2>
					<a href="/login">Login with Lark</a>
				</div>
			</body>
			</html>`
		c.String(http.StatusOK, html)
	}
}

func loginHandler(c *gin.Context) {
	session := sessions.Default(c)

	// Generate state for CSRF protection
	state := fmt.Sprintf("%d", rand.Int63())
	session.Set("state", state)

	// Generate PKCE code verifier
	verifier := oauth2.GenerateVerifier()
	session.Set("code_verifier", verifier)
	session.Save()

	// Build authorization URL with PKCE
	url := oauthConfig.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func callbackHandler(c *gin.Context) {
	session := sessions.Default(c)
	ctx := context.Background()

	// Check for error (user denied authorization)
	if errParam := c.Query("error"); errParam != "" {
		log.Printf("Authorization error: %s", errParam)
		c.Redirect(http.StatusTemporaryRedirect, "/")
		return
	}

	// Validate state parameter
	expectedState := session.Get("state")
	state := c.Query("state")
	if state != expectedState {
		log.Printf("Invalid state: expected '%v', got '%s'", expectedState, state)
		c.String(http.StatusForbidden, "Invalid state parameter (CSRF detected)")
		return
	}

	// Get authorization code
	code := c.Query("code")
	if code == "" {
		log.Println("Missing authorization code")
		c.Redirect(http.StatusTemporaryRedirect, "/")
		return
	}

	// Get code verifier from session
	codeVerifier, _ := session.Get("code_verifier").(string)

	// Exchange code for tokens
	token, err := oauthConfig.Exchange(ctx, code, oauth2.VerifierOption(codeVerifier))
	if err != nil {
		log.Printf("Token exchange failed: %s", err)
		c.String(http.StatusBadRequest, "Token exchange failed")
		return
	}

	// Store tokens in session
	session.Set("access_token", token.AccessToken)
	session.Set("refresh_token", token.RefreshToken)

	// Fetch user info
	client := oauthConfig.Client(ctx, token)
	req, err := http.NewRequest("GET", "https://open.larksuite.com/open-apis/authen/v1/user_info", nil)
	if err != nil {
		log.Printf("Failed to create request: %s", err)
		c.Redirect(http.StatusTemporaryRedirect, "/")
		return
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to get user info: %s", err)
		c.Redirect(http.StatusTemporaryRedirect, "/")
		return
	}
	defer resp.Body.Close()

	var userResponse struct {
		Code int `json:"code"`
		Data struct {
			Name   string `json:"name"`
			Email  string `json:"email"`
			UserID string `json:"user_id"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userResponse); err != nil {
		log.Printf("Failed to decode user info: %s", err)
		c.Redirect(http.StatusTemporaryRedirect, "/")
		return
	}

	if userResponse.Code == 0 {
		session.Set("user", userResponse.Data.Name)
		session.Set("user_email", userResponse.Data.Email)
	}

	// Clean up OAuth state
	session.Delete("state")
	session.Delete("code_verifier")
	session.Save()

	c.Redirect(http.StatusTemporaryRedirect, "/")
}

func logoutHandler(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Save()
	c.Redirect(http.StatusTemporaryRedirect, "/")
}

func refreshHandler(c *gin.Context) {
	session := sessions.Default(c)
	ctx := context.Background()

	refreshToken, ok := session.Get("refresh_token").(string)
	if !ok || refreshToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No refresh token available"})
		return
	}

	// Create token source for refresh
	token := &oauth2.Token{
		RefreshToken: refreshToken,
	}

	tokenSource := oauthConfig.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		log.Printf("Token refresh failed: %s", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token refresh failed"})
		return
	}

	// Update tokens in session
	session.Set("access_token", newToken.AccessToken)
	session.Set("refresh_token", newToken.RefreshToken)
	session.Save()

	c.JSON(http.StatusOK, gin.H{"message": "Token refreshed successfully"})
}
```

## Environment Variables (.env)

```
LARK_APP_ID=cli_xxxxx
LARK_APP_SECRET=xxxxx
REDIRECT_URI=http://localhost:8080/callback
SECRET_KEY=your-secret-key-here
PORT=8080
```

## Running the Application

```bash
# Load environment and run
go run main.go
```

## Production Considerations

1. **Use Redis for sessions** - Replace cookie store with Redis:
   ```bash
   go get github.com/gin-contrib/sessions/redis
   ```

2. **Use secure session cookies** - Configure `Secure: true` for HTTPS

3. **Add rate limiting** - Use middleware like `github.com/ulule/limiter`

4. **Proper error logging** - Use structured logging in production

## Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 20002 | Invalid client_secret | Verify APP_SECRET is correct |
| 20003 | Authorization code not found | Code already used or invalid |
| 20004 | Authorization code expired | Code valid for 5 minutes only |
| 20010 | User lacks app permission | User needs access to the app |
| 20049 | PKCE verification failed | Ensure code_verifier matches |
| 20071 | redirect_uri mismatch | Must match exactly |