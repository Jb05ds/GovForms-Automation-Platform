    (3-14-2026 - 3-16-2026) – Form Downloading

    Goal
    Download PDF forms found by the crawler.

    What I Did
    - Installed axios for downloading files
    - Created downloader service
    - Implemented automatic file download
    - Installed Puppeteer

    Result
    Error ahawhahwa - Encountered bot detection errors(error 403) when downloading directly via axios server blocked automated requests

    Next Step
    Use puppeteer to be able to launch as a real browser to connect to the server


    --------------------------------------------------------------------------
    --------------------------------------------------------------------------


    (3-17-2026 - 3-18-2026) – Web Crawling and Form Discovery

    Goal
    Crawl a government agency website using puppeeteer and find + download their PDF forms automatically.

    What I Did
    - Switched from axios to puppeteer-extra with stealth plugin to bypass bot detection
    - Identified SSS (sss.gov.ph) as the first working target agency — no Cloudflare,
    direct PDF links hosted at sss.gov.ph/wp-content/uploads/
    - Successfully crawled and downloaded all 65 SSS forms

    Result
    Crawler fully working for SSS finds 65 forms, downloads all PDFs to /downloads folder.
    Confirmed that not all agencies are crawlable (e.g. AFAB uses Cloudflare + external sites).

    Next Step
    Generate a hash/fingerprint for each downloaded PDF and store it in a database,
    so the next crawl can detect which forms have changed.

    --------------------------------------------------------------------------
    --------------------------------------------------------------------------

    (3-19-2026) – PDF Hashing

    Goal
    Generate a hasher for each downloaded PDF so changes can be detected on future crawls.

    What I Did
    - Created hasher.js service that reads a PDF file and returns its hash
    - Started setting up database connection for storing hashes

    Result
    Hashing working successfully each PDF now gets a unique SHA-256 hash.

    Next Step
    Connect to database and store the hash, file name, and download date
    so the next crawl can compare and detect updated forms.