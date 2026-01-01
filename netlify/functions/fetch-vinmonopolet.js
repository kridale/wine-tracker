exports.handler = async (event) => {
const headers = {
‘Access-Control-Allow-Origin’: ‘*’,
‘Access-Control-Allow-Headers’: ‘Content-Type’,
‘Content-Type’: ‘application/json’,
};

// Get API key from environment variable
const apiKey = process.env.VINMONOPOLET_API_KEY;

if (!apiKey) {
return {
statusCode: 500,
headers,
body: JSON.stringify({
error: ‘API key not configured’,
message: ‘Please add VINMONOPOLET_API_KEY to your Netlify environment variables’
})
};
}

try {
console.log(‘Fetching from Vinmonopolet API…’);

```
// Vinmonopolet's Open API endpoint
const apiUrl = 'https://api.vinmonopolet.no/products/v0/details-normal';

const response = await fetch(apiUrl, {
  method: 'GET',
  headers: {
    'Ocp-Apim-Subscription-Key': apiKey,
    'Accept': 'application/json'
  }
});

console.log('API Response status:', response.status);

if (!response.ok) {
  const errorText = await response.text();
  console.error('API Error:', errorText);
  
  return {
    statusCode: response.status,
    headers,
    body: JSON.stringify({
      error: 'API request failed',
      status: response.status,
      message: errorText
    })
  };
}

const data = await response.json();
console.log('Products received:', data.length || 0);

// Transform the data to a cleaner format if needed
const products = Array.isArray(data) ? data : data.products || [];

return {
  statusCode: 200,
  headers,
  body: JSON.stringify({
    products: products,
    count: products.length,
    timestamp: new Date().toISOString()
  })
};
```

} catch (error) {
console.error(‘Function error:’, error);
return {
statusCode: 500,
headers,
body: JSON.stringify({
error: ‘Internal server error’,
message: error.message
})
};
}
};
