import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const logEndRef = useRef(null);
  const itemsPerPage = 50;

  const addLog = useCallback((type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, message, timestamp }]);
  }, []);

  const copyLogs = () => {
    const logText = logs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText);
    addLog('info', 'Logs copied to clipboard');
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'Console cleared');
  };

  useEffect(() => {
    if (logEndRef.current && showConsole) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showConsole]);

  const loadFavorites = useCallback(async () => {
    try {
      addLog('info', 'Loading favorites from Firebase...');
      const result = await storage.get('wine-favorites');
      if (result?.value) {
        const favs = JSON.parse(result.value);
        setFavorites(favs);
        addLog('success', `Loaded ${favs.length} favorites`);
      } else {
        addLog('info', 'No favorites found');
      }
    } catch (err) {
      addLog('error', `Failed to load favorites: ${err.message}`);
    }
  }, [addLog]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const saveFavorites = async (newFavorites) => {
    try {
      addLog('info', `Saving ${newFavorites.length} favorites...`);
      await storage.set('wine-favorites', JSON.stringify(newFavorites));
      setFavorites(newFavorites);
      addLog('success', 'Favorites saved successfully');
    } catch (err) {
      addLog('error', `Failed to save favorites: ${err.message}`);
      console.error('Failed to save favorites:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    setShowConsole(true);
    clearLogs();
    addLog('info', 'Starting product fetch...');
    
    try {
      addLog('info', 'Checking Firebase for cached products...');
      const result = await storage.get('vinmonopolet-products');
      
      if (result?.value) {
        addLog('success', 'Found cached products in Firebase');
        const data = JSON.parse(result.value);
        setProducts(data);
        addLog('success', `Loaded ${data.length} products from cache`);
        setLoading(false);
        return;
      }

      addLog('info', 'No cache found, fetching from Vinmonopolet API...');
      let allProducts = [];
      let start = 0;
      const batchSize = 1000;
      let batchNumber = 1;
      
      while (true) {
        setProgress({ 
          current: start, 
          total: '?', 
          status: `Fetching batch ${batchNumber}...` 
        });
        addLog('info', `Fetching batch ${batchNumber} (products ${start}-${start + batchSize})...`);
        
        const response = await fetch(`/.netlify/functions/vinmonopolet?start=${start}&maxResults=${batchSize}`);
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        
        const batch = await response.json();
        
        if (!batch || batch.length === 0) {
          addLog('info', 'No more products to fetch');
          break;
        }
        
        allProducts = [...allProducts, ...batch];
        addLog('success', `Batch ${batchNumber} complete: ${batch.length} products (Total: ${allProducts.length})`);
        
        if (batch.length < batchSize) {
          addLog('info', 'Received partial batch, reached end of dataset');
          break;
        }
        
        start += batchSize;
        batchNumber++;
        
        setProgress({ 
          current: allProducts.length, 
          total: '~65000', 
          status: `Downloaded ${allProducts.length} products...` 
        });
        
        addLog('info', 'Waiting 1 second before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      addLog('success', `Download complete! Total: ${allProducts.length} products`);
      setProgress({ 
        current: allProducts.length, 
        total: allProducts.length, 
        status: 'Saving to Firebase...' 
      });
      
      addLog('info', 'Saving products to Firebase...');
      const jsonData = JSON.stringify(allProducts);
      const sizeMB = (jsonData.length / 1024 / 1024).toFixed(2);
      addLog('info', `Data size: ${sizeMB} MB`);
      
      await storage.set('vinmonopolet-products', jsonData, (logEvent) => {
        addLog(logEvent.type, logEvent.message);
      });
      
      setProducts(allProducts);
      addLog('success', `All ${allProducts.length} products saved and loaded!`);
      setProgress({ 
        current: allProducts.length, 
        total: allProducts.length, 
        status: 'Complete!' 
      });
      
    } catch (err) {
      setError(err.message);
      addLog('error', `Fatal error: ${err.message}`);
      console.error('Fetch error:', err);
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

  const showSampleProduct = async () => {
    try {
      setShowConsole(true);
      addLog('info', 'Fetching sample products from API (attempting wine filter)...');

      // First try a filtered request for wines. If API supports productType=wine or category filters this will help.
      const filterUrl = '/.netlify/functions/vinmonopolet?start=0&maxResults=50&productType=wine';
      let response = await fetch(filterUrl);

      if (!response.ok) {
        // If filtered request failed (e.g. filter unsupported), fall back to unfiltered request
        addLog('info', 'Filtered request failed or unsupported, falling back to unfiltered fetch');
        response = await fetch('/.netlify/functions/vinmonopolet?start=0&maxResults=50');
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const batch = await response.json();
      if (!batch || batch.length === 0) {
        addLog('info', 'No products returned from API');
        alert('No products returned from API.');
        return;
      }

      // Helper to determine if an item looks like a wine
      const isProbablyWine = (p) => {
        // Check common wine indicators: vintage, producer/manufacturer, alcohol content, or product type
        const basic = p.basic || {};
        if (basic.vintage) return true;
        if ((basic.manufacturer && basic.manufacturer.name) || basic.producer) return true;
        if (basic.alcoholPercentage || p.alcoholPercentage || p.prices?.some?.()) return true;
        const productType = (basic.productSelection || p.productType || '').toString().toLowerCase();
        if (productType.includes('wine')) return true;
        // Sometimes names include year like "2018" — simple heuristic
        const name = (basic.productLongName || p.name || '').toString();
        if (/\b(19|20)\d{2}\b/.test(name)) return true;
        return false;
      };

      // Find the first likely wine
      let firstWine = batch.find(isProbablyWine);
      if (!firstWine) {
        // If none matched, just take the first item
        firstWine = batch[0];
        addLog('warn', 'No item matched wine heuristics; showing first returned item');
      } else {
        addLog('success', 'Found a product that looks like a wine');
      }

      const sample = JSON.stringify(firstWine, null, 2);

      // Add the complete JSON of the chosen product to the in-app debug console
      addLog('debug', sample);
      addLog('success', 'Sample product JSON added to debug output');

      // Try to copy to clipboard as well for convenience
      try {
        await navigator.clipboard.writeText(sample);
        addLog('info', 'Sample product data copied to clipboard');
        alert('Sample product JSON added to debug output and copied to clipboard.');
      } catch (copyErr) {
        addLog('warn', 'Could not copy sample to clipboard');
        alert('Sample product JSON added to debug output. Could not copy to clipboard.');
        console.log('Full product sample:', firstWine);
      }
    } catch (err) {
      addLog('error', `Failed to fetch sample products: ${err.message}`);
      alert(`Failed to fetch sample products: ${err.message}`);
      console.error('Sample fetch error:', err);
    }
  };

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

          <button 
            className="console-toggle"
            onClick={() => setShowConsole(!showConsole)}
          >
            {showConsole ? 'Hide Console' : 'Show Console'}
          </button>

          <button 
            className="console-toggle"
            onClick={showSampleProduct}
          >
            Debug: Show Sample
          </button>
        </div>
      </header>

      {loading && progress.status && (
        <div className="progress-bar">
          <div className="progress-info">
            <span>{progress.status}</span>
            {progress.total !== 0 && (
              <span>{progress.current} / {progress.total}</span>
            )}
          </div>
          <div className="progress-track">
            <div 
              className="progress-fill" 
              style={{ 
                width: progress.total && progress.total !== '?' 
                  ? `${(progress.current / progress.total) * 100}%` 
                  : '50%' 
              }}
            />
          </div>
        </div>
      )}

      {showConsole && (
        <div className="console">
          <div className="console-header">
            <span>Console Log</span>
            <div className="console-actions">
              <button onClick={copyLogs} className="console-btn">Copy All</button>
              <button onClick={clearLogs} className="console-btn">Clear</button>
            </div>
          </div>
          <div className="console-body">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry log-${log.type}`}>
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span className="log-type">[{log.type.toUpperCase()}]</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {error && (
        <div className="error">
          Error: {error}
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
