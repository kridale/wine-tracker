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
    const searchUrl = 'https://www.vinmonopolet.no/search?q=' + encodeURIComponent(producer) + '&searchType=product';
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.vinmonopolet.no/'
      }
    });

    if (!response.ok) {
      console.error('Vinmonopolet returned:', response.status);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          products: [],
          note: 'Vinmonopolet search unavailable. You can still add wines manually.'
        })
      };
    }

    const html = await response.text();
    const products = [];
    
    const productMatches = html.match(/<article[^>]*class="[^"]*product-item[^"]*"[^>]*>[\s\S]*?<\/article>/gi) || [];
    
    for (const match of productMatches.slice(0, 20)) {
      try {
        const nameMatch = match.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) || 
                         match.match(/data-product-name="([^"]+)"/i) ||
                         match.match(/<span[^>]*class="[^"]*product-name[^"]*"[^>]*>([^<]+)<\/span>/i);
        const name = nameMatch ? nameMatch[1].trim() : '';
        
        const priceMatch = match.match(/data-product-price="([^"]+)"/i) ||
                          match.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>[\s\S]*?([0-9]+[,.]?[0-9]*)/i);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : null;
        
        const codeMatch = match.match(/data-product-code="([^"]+)"/i) ||
                         match.match(/\/p\/(\d+)/);
        const code = codeMatch ? codeMatch[1] : '';
        
        const urlMatch = match.match(/<a[^>]*href="([^"]*\/p\/[^"]+)"/i);
        const productPath = urlMatch ? urlMatch[1] : '';
        const url = productPath ? 'https://www.vinmonopolet.no' + productPath : '';
        
        const inStock = !match.includes('out-of-stock') && 
                       !match.includes('Utsolgt') &&
                       !match.includes('unavailable');
        
        if (name && code) {
          products.push({
            code: code,
            name: name,
            price: price,
            url: url,
            stock: inStock ? 'in_stock' : 'out_of_stock',
            productName: name
          });
        }
      } catch (parseError) {
        console.error('Error parsing product:', parseError);
      }
    }

    if (products.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          products: [],
          note: 'No results found for "' + producer + '". Try searching directly on vinmonopolet.no',
          searchUrl: 'https://www.vinmonopolet.no/search?q=' + encodeURIComponent(producer)
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products: products,
        count: products.length,
        producer: producer
      })
    };

  } catch (error) {
    console.error('Search error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products: [],
        error: 'Search temporarily unavailable',
        note: 'You can still add wines manually by visiting vinmonopolet.no',
        searchUrl: 'https://www.vinmonopolet.no/search?q=' + encodeURIComponent(producer)
      })
    };
  }
};
