exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  const apiKey = process.env.VINMONOPOLET_API_KEY;
  
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "API key not configured",
        message: "Please add VINMONOPOLET_API_KEY to environment variables"
      })
    };
  }

  try {
    const apiUrl = "https://api.vinmonopolet.no/products/v0/details-normal";
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: "API request failed",
          status: response.status,
          message: errorText
        })
      };
    }

    const data = await response.json();
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

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message
      })
    };
  }
};
