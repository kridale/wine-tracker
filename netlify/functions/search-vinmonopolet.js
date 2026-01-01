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
    // Use Vinmonopolet's public search API (no auth needed)
    const searchUrl = `https://www.vinmonopolet.no/vmpws/v2/vmp/search?searchType=product&q=${encodeURIComponent(producer)}&pageSize=20`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    const products = (data.productSearchResult?.products || []).map(p => ({
      name: p.name || 'Unknown',
      price: p.price?.value || 0,
      stock: p.status || 'Unknown',
      productId: p.code,
      url: `https://www.vinmonopolet.no${p.url}`,
      image: p.images?.[0]?.url
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products,
        count: products.length,
        producer
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Search failed',
        message: error.message,
        producer
      })
    };
  }
};
