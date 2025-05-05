"use server";

import * as cheerio from 'cheerio';

export async function scrapeArxivHtml(url: string): Promise<{ success: boolean; htmlContent?: string; textChunks?: string[]; error?: string }> {
  console.log('Scraping URL:', url); // Log the URL being scraped

  if (!url || !url.startsWith('https://arxiv.org/html/')) {
    return { success: false, error: 'Invalid arXiv HTML URL provided. Must start with https://arxiv.org/html/' };
  }

  try {
    const response = await fetch(url, {
      headers: {
        // Mimic a browser request
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error('Fetch failed:', response.status, response.statusText);
      return { success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Select the main article content container
    const articleElement = $('article.ltx_document');

    if (articleElement.length === 0) {
        console.error('Could not find article.ltx_document element');
        return { success: false, error: 'Could not find main article content on the page.' };
    }

    // --- Remove all image elements ---
    articleElement.find('img').remove();
    console.log('[Image Removal] Removed all img tags from the article content.');
    // --- End Image Removal ---

    // --- Wrap individual block-level elements and extract text ---
    const textChunks: string[] = []; // Array to hold text content of chunks
    const blockSelectors = 'p, ul, ol, blockquote, pre, dl'; // Add more selectors as needed (e.g., h1-h6)
    articleElement.find(blockSelectors).each((_, el) => {
        const $el = $(el);
        // Avoid wrapping elements that are already wrapped or essentially empty
        const currentText = $el.text().trim(); // Get text early
        if ($el.parent().hasClass('content-chunk') || currentText === '') {
            return;
        }

        // Avoid wrapping list items directly, wrap the parent list instead
        if ($el.is('li') && $el.parent().is('ul, ol')) {
             const $parentList = $el.parent();
             // Check if the parent list is *already* wrapped
             if (!$parentList.parent().hasClass('content-chunk')) {
                 const listText = $parentList.text().trim(); // Get text of the list
                 if (listText !== '') {
                    $parentList.wrap('<div class="content-chunk"></div>');
                    textChunks.push(listText); // Add text of the whole list
                 }
             }
             // Skip processing the LI further, as the list is handled
             return;
        }

        // Wrap other block elements (p, blockquote, pre, dl) or lists (ul, ol) directly
        // Ensure the element itself isn't already wrapped (might happen if UL/OL processed after LI)
        if (!$el.parent().hasClass('content-chunk')) {
             $el.wrap('<div class="content-chunk"></div>');
             textChunks.push(currentText); // Add text of the element
        }
    });
    console.log(`[Chunking] Wrapped elements matching "${blockSelectors}" and extracted ${textChunks.length} text chunks.`);
    // --- End Chunking ---

    // Get the modified HTML content of the article (with chunks wrapped)
    const articleHtml = articleElement.html();

    if (!articleHtml) {
        console.error('article.ltx_document element found but contains no HTML.');
        return { success: false, error: 'Main article content is empty.' };
    }

    console.log('Scraping successful, returning HTML content and text chunks.');
    // Return HTML content AND the array of text chunks
    return { success: true, htmlContent: articleHtml, textChunks: textChunks };

  } catch (error) {
    console.error('Error during scraping:', error);
    // Check if the error is a FetchError or similar network issue
    if (error instanceof Error) {
        return { success: false, error: `Scraping failed: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred during scraping.' };
  }
}
