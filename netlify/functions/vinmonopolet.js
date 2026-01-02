const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const API_KEY = 'c53c9b559f824a80b3a94b9d565ecaaa';
    const { start = 0, maxResults = 1000 } = event.queryStringParameters || {};
    
    const url = `https://apis.vinmonopolet.no/products/v0/details-normal?start=${start}&maxResults=${maxResults}`;
    
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // The API might return { products: [...] } or just [...]
    // Return just the products array
    const products = Array.isArray(data) ? data : (data.products || data);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(products)
    };
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: 'Failed to fetch from Vinmonopolet API'
      })
    };
  }
};
