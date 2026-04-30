# Get a valid postId first
Write-Host "🔍 Getting a valid post ID..." -ForegroundColor Cyan

try {
    $postResponse = Invoke-WebRequest `
        -Uri "http://localhost:3000/api/test-posts" `
        -Method GET `
        -ErrorAction Stop
    
    $postData = $postResponse.Content | ConvertFrom-Json
    $postId = $postData.postId
    Write-Host "✅ Using Post ID: $postId ($($postData.title))" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to get post ID: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test async comment submission
$testData = @{
    postId = $postId
    content = "This is a spam test with explicit adult content and malicious links"
    guestName = "Test User"
    guestEmail = "test@example.com"
}

$jsonBody = $testData | ConvertTo-Json

Write-Host "📤 Submitting comment..." -ForegroundColor Cyan
$startTime = Get-Date

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:3000/api/comments" `
        -Method POST `
        -ContentType "application/json" `
        -Body $jsonBody `
        -ErrorAction Stop

    $endTime = Get-Date
    $responseTime = ($endTime - $startTime).TotalMilliseconds

    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "`n✅ Response received in: $responseTime ms" -ForegroundColor Green
    Write-Host "`nResponse Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "`nComment ID: $($data.comment.id)" -ForegroundColor Yellow
    Write-Host "Initial Risk Score: $($data.comment.riskScore)" -ForegroundColor Yellow
    Write-Host "Risk Reasons: $($data.comment.riskReasons)" -ForegroundColor Yellow
    Write-Host "`n⏳ Waiting 3 seconds for background AI analysis to complete..." -ForegroundColor Cyan
    
    Start-Sleep -Seconds 3
    
    # Check updated score
    Write-Host "`n🔍 Checking updated comment status..." -ForegroundColor Cyan
    $updatedResponse = Invoke-WebRequest `
        -Uri "http://localhost:3000/api/admin/comments?id=$($data.comment.id)" `
        -Method GET `
        -ErrorAction Stop
    
    $updatedData = $updatedResponse.Content | ConvertFrom-Json
    Write-Host "`n📊 Updated Risk Score: $($updatedData.riskScore)" -ForegroundColor Yellow
    Write-Host "Updated Risk Reasons: $($updatedData.riskReasons)" -ForegroundColor Yellow
    $status = if ($updatedData.approved) { 'Approved' } else { 'Pending' }
    Write-Host "Status: $status" -ForegroundColor Yellow
    
    if ($null -ne $updatedData.aiAnalysisResult) {
        Write-Host "`n🤖 AI Analysis Result: $($updatedData.aiAnalysisResult)" -ForegroundColor Cyan
    }
    
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
