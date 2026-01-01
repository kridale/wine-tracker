exports.handler = async (event) => {
  const producer = event.queryStringParameters.producer;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (!producer) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Producer name required' })
    };
  }

  try {
    const apiKey = process.env.VINMONOPOLET_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          products: [
            {
              name: `${producer} - Demo Wine 2020`,
              price: 299,
              stock: 'In Stock',
              productId: 'demo-001'
            },
            {
              name: `${producer} - Demo Wine 2019`,
              price: 349,
              stock: 'Limited Stock',
              productId: 'demo-002'
            }
          ],
          note: 'Demo results. Add VINMONOPOLET_API_KEY for real data.'
        })
      };
    }

    const response = await fetch(
      `https://api.vinmonopolet.no/products/v0/details/search?searchTerm=${encodeURIComponent(producer)}`,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      }
    );

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products: data.products || [],
        count: data.products?.length || 0
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Search failed',
        message: error.message 
      })
    };
  }
};
