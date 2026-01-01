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
    // Try the facet search endpoint
    const searchUrl = `https://www.vinmonopolet.no/vmpSite/search/productSearch?searchType=product&q=${encodeURIComponent(producer)}&currentPage=0`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    // Log for debugging
    console.log('Response status:', response.status);
    console.log('Content-Type:', contentType);
    console.log('Response preview:', text.substring(0, 200));

    if (!response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          products: [],
          note: `Vinmonopolet API unavailable. Search manually: https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`,
          searchUrl: `https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`
        })
      };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // If not JSON, return search link
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          products: [],
          note: `Auto-search unavailable. Click to search: https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`,
          searchUrl: `https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`
        })
      };
    }

    // Try to extract products from various possible formats
    const products = (
      data.products || 
      data.productSearchResult?.products || 
      data.results ||
      []
    ).slice(0, 20).map(p => ({
      name: p.name || p.productName || 'Unknown',
      price: p.price?.value || p.price || 0,
      stock: p.stock || p.status || 'Check availability',
      productId: p.code || p.id,
      url: p.url ? `https://www.vinmonopolet.no${p.url}` : `https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`,
      image: p.images?.[0]?.url || p.image
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products,
        count: products.length,
        producer,
        searchUrl: `https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`
      })
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        products: [],
        note: `Search temporarily unavailable. Click to search manually: https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`,
        searchUrl: `https://www.vinmonopolet.no/search?q=${encodeURIComponent(producer)}`,
        error: error.message
      })
    };
  }
};
    
