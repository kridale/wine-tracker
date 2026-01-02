import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { storage } from './firebase';

function App() {
  const [products, setProducts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const result = await storage.get('wine-favorites');
      if (result?.value) {
        setFavorites(JSON.parse(result.value));
      }
    } catch (err) {
      console.log('No saved favorites yet');
    }
  };

  const saveFavorites = async (newFavorites) => {
    try {
      await storage.set('wine-favorites', JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await storage.get('vinmonopolet-products');
      
      if (result?.value) {
        const data = JSON.parse(result.value);
        setProducts(data);
        setLoading(false);
        return;
      }

      let allProducts = [];
      let start = 0;
      const batchSize = 1000;
      
      while (true) {
        const response = await fetch(`/.netlify/functions/vinmonopolet?start=${start}&maxResults=${batchSize}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        
        const batch = await response.json();
        
        if (!batch || batch.length === 0) break;
        
        allProducts = [...allProducts, ...batch];
        
        if (batch.length < batchSize) break;
        
        start += batchSize;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await storage.set('vinmonopolet-products', JSON.stringify(allProducts));
      setProducts(allProducts);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (product) => {
    const productId = product.basic?.productId || product.code;
    const isFavorite = favorites.some(f => {
      const fId = f.basic?.productId || f.code;
      return fId === productId;
    });
    
    if (isFavorite) {
      saveFavorites(favorites.filter(f => {
        const fId = f.basic?.productId || f.code;
        return fId !== productId;
      }));
    } else {
      saveFavorites([...favorites, product]);
    }
  };

  const isFavorite = (product) => {
    const productId = product.basic?.productId || product.code;
    return favorites.some(f => {
      const fId = f.basic?.productId || f.code;
      return fId === productId;
    });
  };

  const filteredProducts = useMemo(() => {
    let items = currentView === 'favorites' ? favorites : products;
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      items = items.filter(p => {
        const name = p.basic?.productLongName || p.name || '';
        const producer = p.basic?.manufacturer?.name || '';
        return name.toLowerCase().includes(search) || 
               producer.toLowerCase().includes(search);
      });
    }
    
    return items;
  }, [products, favorites, searchTerm, currentView]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, currentView]);

  return (
    <div className="app">
      <header className="header">
        <h1>Wine Tracker</h1>
        
        <div className="controls">
          <input
            type="text"
            className="search"
            placeholder="Search wines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="view-toggle">
            <button 
              className={currentView === 'all' ? 'active' : ''}
              onClick={() => setCurrentView('all')}
            >
              All ({products.length})
            </button>
            <button 
              className={currentView === 'favorites' ? 'active' : ''}
              onClick={() => setCurrentView('favorites')}
            >
              Favorites ({favorites.length})
            </button>
          </div>

          <button 
            className="refresh-btn"
            onClick={fetchProducts}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          Loading products...
        </div>
      )}

      {!loading && filteredProducts.length === 0 && (
        <div className="empty">
          {currentView === 'favorites' 
            ? 'No favorites yet. Click the star on any wine to add it.'
            : searchTerm 
              ? 'No wines match your search.'
              : 'Click "Refresh Data" to load wines from Vinmonopolet.'}
        </div>
      )}

      {paginatedProducts.length > 0 && (
        <>
          <div className="products">
            {paginatedProducts.map((product, index) => {
              const productId = product.basic?.productId || product.code || index;
              const name = product.basic?.productLongName || product.name || 'Unknown Wine';
              const producer = product.basic?.manufacturer?.name || 'Unknown Producer';
              const price = product.prices?.[0]?.salesPrice || product.price || 'N/A';
              const volume = product.basic?.volume || product.volume || 'N/A';
              const country = product.origins?.origin?.country?.name || product.country || 'N/A';
              const productType = product.basic?.productSelection || product.productType || 'N/A';
              
              return (
                <div key={productId} className="product-card">
                  <div className="product-header">
                    <div className="product-info">
                      <h3>{name}</h3>
                      <p className="producer">{producer}</p>
                    </div>
                    <button 
                      className={`favorite-btn ${isFavorite(product) ? 'active' : ''}`}
                      onClick={() => toggleFavorite(product)}
                      aria-label="Toggle favorite"
                    >
                      ★
                    </button>
                  </div>
                  
                  <div className="product-details">
                    <div className="detail">
                      <span className="label">Price:</span>
                      <span className="value">{price} kr</span>
                    </div>
                    <div className="detail">
                      <span className="label">Volume:</span>
                      <span className="value">{volume} L</span>
                    </div>
                    <div className="detail">
                      <span className="label">Country:</span>
                      <span className="value">{country}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Type:</span>
                      <span className="value">{productType}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
