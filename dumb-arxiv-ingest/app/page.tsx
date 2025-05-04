"use client";

import Image from "next/image";
import { useState, useEffect } from 'react';
import { scrapeArxivHtml } from './actions/actions';
import parse, { domToReact, HTMLReactParserOptions, Element, DOMNode } from 'html-react-parser';

export default function Home() {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [dumbMode, setDumbMode] = useState('eli5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scrapedHtml, setScrapedHtml] = useState<string | null>(null);
  const [textChunks, setTextChunks] = useState<string[] | null>(null);
  const [funTextChunks, setFunTextChunks] = useState<string[] | null>(null);
  const [showFunVersion, setShowFunVersion] = useState<boolean>(true);

  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
  useEffect(() => {
    if (!urlInput) {
      setIsValidUrl(null); 
      return;
    }
    try {
      const parsedUrl = new URL(urlInput);
      setIsValidUrl(parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'arxiv.org' && parsedUrl.pathname.startsWith('/html/'));
    } catch (e) {
      setIsValidUrl(false);
    }
  }, [urlInput]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isValidUrl === false || !urlInput) { 
      setError('Please provide a valid arXiv HTML page URL (e.g., https://arxiv.org/html/xxxx.xxxxx)');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setScrapedHtml(null); 
    setTextChunks(null);
    setFunTextChunks(null);
    setShowFunVersion(true); 

    let scrapedChunks: string[] = [];

    try {
      console.log('Submitting URL:', urlInput, 'Mode:', dumbMode);
      const result = await scrapeArxivHtml(urlInput);

      if (result.success && result.htmlContent && result.textChunks) {
        console.log('Scraping successful. Received HTML content and text chunks.');
        setScrapedHtml(result.htmlContent); 
        setTextChunks(result.textChunks);
        scrapedChunks = result.textChunks;

        if (scrapedChunks.length > 0) {
          console.log('--- Extracted Text Chunks ---');
          scrapedChunks.forEach((chunk, index) => {
            console.log(`Chunk ${index + 1}:`, chunk.substring(0, 100) + '...'); 
          });
          console.log('----------------------------');
        } else {
          console.log('No text chunks returned from server action.');
        }

      } else {
        console.error('Scraping failed:', result.error);
        setError(result.error || 'Failed to scrape the page.');
        setScrapedHtml(null);
        setTextChunks(null);
        setIsSubmitting(false); 
        return; 
      }
    } catch (e) {
      console.error('Error calling server action:', e);
      setError('An unexpected error occurred during scraping.');
      setScrapedHtml(null);
      setTextChunks(null);
      setIsSubmitting(false); 
      return; 
    } 
    
    if (scrapedChunks.length > 0) {
      console.log('Starting incremental fun text fetching...');
      let fetchErrorOccurred = false;
      
      for (const [index, chunk] of scrapedChunks.entries()) {
        console.log(`Fetching fun text for chunk ${index + 1}...`);
        try {
          const myHeaders = new Headers();
          myHeaders.append("Content-Type", "text/plain");
          myHeaders.append("Authorization", "Bearer dumpaihackathon");

          const requestOptions: RequestInit = {
            method: "POST",
            headers: myHeaders,
            body: chunk,
            redirect: "follow"
          };

          console.log("Attempting to get a prompt ")
          
          const response = await fetch("https://dump.goalastair.com/proompt/poem", requestOptions);

          if (!response.ok) {
            throw new Error(`API Error for chunk ${index + 1}: ${response.status} ${response.statusText}`);
          }
          
          const funResult = await response.text();
          console.log(`Received fun text for chunk ${index + 1}.`);
          setFunTextChunks(prevChunks => {
            const newChunks = [...(prevChunks || [])];
            newChunks[index] = funResult;
            return newChunks;
          });
        } catch (fetchError: any) {
          console.error(`Error fetching fun text for chunk ${index + 1}:`, fetchError);
          const errorMsg = `⚠️ Error getting fun version: ${chunk.substring(0, 50)}...`;
          setFunTextChunks(prevChunks => {
            const newChunks = [...(prevChunks || [])];
            newChunks[index] = errorMsg;
            return newChunks;
          });
          fetchErrorOccurred = true;
        }
      }
      
      console.log('Finished incremental fun text fetching loop.');
      if (fetchErrorOccurred) {
        setError("Some fun text versions could not be loaded.");
      }
    } else {
      setFunTextChunks([]);
    }

    setIsSubmitting(false); 

  };

  const parserOptions: HTMLReactParserOptions = {
    replace: (domNode) => {
      if (
        domNode instanceof Element &&
        domNode.type === 'tag' &&
        domNode.name === 'div' &&
        domNode.attribs.class === 'content-chunk'
      ) {
        return (
          <div className="mb-4 p-4 bg-gray-100 rounded-md shadow border border-gray-300 overflow-hidden prose max-w-none">
            {domToReact(domNode.children as DOMNode[], parserOptions)}
          </div>
        );
      }
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <nav className="w-full bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                dumbXiv
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {!textChunks && !isSubmitting && (
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-extrabold text-gray-800 sm:text-5xl md:text-6xl mb-6">
              Make arXiv Readable (Again?) 
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-600 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl mb-8">
              Paste an arXiv <code className="text-sm bg-gray-200 px-1 rounded">/html/</code> URL to get started.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <div>
                <label htmlFor="urlInput" className="block text-sm font-medium text-gray-700 mb-1 text-left">
                  arXiv HTML URL
                </label>
                <input
                  type="url"
                  id="urlInput"
                  name="urlInput"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://arxiv.org/html/xxxx.xxxxx"
                  required
                  className={`w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${isValidUrl === false ? 'border-red-500 ring-red-500' : 'border-gray-300 focus:border-purple-500'}`}
                />
                <p className={`mt-1 text-xs text-left ${isValidUrl === false ? 'text-red-600' : 'text-gray-500'}`}>
                  {isValidUrl === false ? 'Must be like https://arxiv.org/html/...' : 'Remember the /html/ part!'}
                </p>
              </div>

              <div>
                <label htmlFor="dumbMode" className="block text-sm font-medium text-gray-700 mb-1 text-left">
                  Select Dumb Mode:
                </label>
                <select
                  id="dumbMode"
                  name="dumbMode"
                  value={dumbMode}
                  onChange={(e) => setDumbMode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                  <option value="eli5">Explain Like I'm 5</option>
                  <option value="teen">Explain Like I'm a Teenager</option>
                  <option value="dude">Explain Like a Dude</option>
                  <option value="pirate">Explain Like a Pirate</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || isValidUrl === false}
              >
                {isSubmitting ? 'Dumbifying...' : 'Make it Dumb!'}
              </button>
            </form>
            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
                Error: {error}
              </div>
            )}
          </div>
        )}

        {isSubmitting && (
          <div className="text-center py-10">
            <p className="text-lg font-semibold text-purple-700">Processing the paper...</p>
            <p className="text-sm text-gray-600">Harnessing the power of dumbness...</p>
            <svg className="animate-spin h-8 w-8 text-purple-600 mx-auto mt-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {(textChunks || funTextChunks) &&  ( 
          <div className="w-full max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                {showFunVersion ? ' Fun Version ' : ' Original Content'}
              </h2>
              <div className="flex items-center gap-4">
                {(textChunks && textChunks.length > 0) && ( 
                  <button
                    onClick={() => setShowFunVersion(prev => !prev)}
                    className={`py-1 px-4 rounded-full text-sm font-medium border transition duration-150 ease-in-out ${showFunVersion
                      ? 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 focus:ring-2 focus:ring-purple-400'
                      : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 focus:ring-2 focus:ring-blue-400'
                      }`}
                    disabled={showFunVersion && (!funTextChunks || funTextChunks.length !== textChunks.length)}
                  >
                    {showFunVersion 
                        ? (!funTextChunks ? 'Loading Original...' : 'Switch to Original') 
                        : (!funTextChunks ? 'Loading Fun...' : 'Switch to Fun Version')
                    }
                  </button>
                )}
                <button
                  onClick={() => { setScrapedHtml(null); setTextChunks(null); setFunTextChunks(null); setError(''); setUrlInput(''); setShowFunVersion(true); }} 
                  className="py-1 px-4 border border-gray-300 rounded-full text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition duration-150 ease-in-out"
                >Scrape Another</button>
              </div>
            </div>

            <div className="max-w-none">
              {(() => {
                const cardBgClass = showFunVersion ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200';

                // Ensure original textChunks exist before trying to map
                if (!textChunks || textChunks.length === 0) {
                   return <p className="text-gray-500 text-center">No text content chunks found.</p>;
                }

                return (
                  <div className="flex flex-col gap-4">
                  {textChunks.map((originalChunk, index) => (
                      <div
                      key={index}
                      className={`p-4 rounded-lg shadow border overflow-hidden ${cardBgClass}`}
                      >
                      {showFunVersion ? (
                        // If fun version selected, check if it's loaded for this index
                        funTextChunks && funTextChunks[index] !== null ? (
                            <p className="text-gray-800 whitespace-pre-wrap">
                                {funTextChunks[index]}
                            </p>
                        ) : (
                            // Show loading or placeholder if fun text isn't ready
                            <p className="text-gray-500 italic">Loading fun version (chunk {index + 1})...</p>
                        )
                      ) : (
                        // Otherwise, show the original chunk
                        <p className="text-gray-800 whitespace-pre-wrap">
                            {originalChunk}
                        </p>
                      )}
                      </div>
                  ))}
                  </div>
                );
                  
                // Fallback if something went wrong (should ideally be covered above)
                return <p className="text-gray-500 text-center">Error displaying content.</p>;

              })()}
            </div>
          </div>
        )}
      </main>
      <footer className="w-full py-4 text-center text-xs text-gray-500 border-t border-gray-200 mt-12">
        Built with questionable amounts of caffeine.
      </footer>
    </div>
  );
}
