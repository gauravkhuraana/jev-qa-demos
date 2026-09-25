// Sample failed tests from a nightly CI run.
// We (the humans) already know the right answer for each one ("expected"),
// so the demo can put Jev's answer next to the truth.
//
// | ID  | Test                          | Expected    |
// |-----|-------------------------------|-------------|
// | T01 | checkout coupon               | product_bug |
// | T02 | login dashboard               | flaky       |
// | T03 | orders list                   | environment |
// | T04 | profile save                  | test_bug    |
// | T05 | search results                | product_bug |
// | T06 | payments refund               | environment |
// | T07 | notifications toast           | flaky       |
// | T08 | reports CSV export            | test_bug    |

export type FailureCategory = 'product_bug' | 'test_bug' | 'environment' | 'flaky';

export type TestFailure = {
  id: string;
  test: string;
  error: string;
  history: string; // last 10 runs, oldest -> newest. P = pass, F = fail
  expected: FailureCategory;
};

export const failures: TestFailure[] = [
  {
    id: 'T01',
    test: 'checkout › applies 10% coupon to cart total',
    error: 'AssertionError: expected 900 but received 1000. Coupon SAVE10 accepted (HTTP 200) but total unchanged.',
    history: 'PPPPPPPPPF',
    expected: 'product_bug',
  },
  {
    id: 'T02',
    test: 'login › shows dashboard after valid login',
    error: "TimeoutError: page.waitForSelector: Timeout 5000ms exceeded waiting for '#dashboard'. Passed on retry 1.",
    history: 'PFPPFPPPFP',
    expected: 'flaky',
  },
  {
    id: 'T03',
    test: 'orders › lists last 5 orders',
    error: 'Error: connect ECONNREFUSED 10.0.4.12:5432 — could not connect to postgres (orders-db-staging).',
    history: 'PPPPPPPPPF',
    expected: 'environment',
  },
  {
    id: 'T04',
    test: 'profile › updates display name',
    error: "Error: locator('#btn-save-profile') resolved to 0 elements. Recent commit renamed button id to 'save-profile-btn'.",
    history: 'PPPPPPPPPF',
    expected: 'test_bug',
  },
  {
    id: 'T05',
    test: 'search › returns results for "laptop"',
    error: 'AssertionError: expected results.length > 0, received 0. API /search?q=laptop returned 500 Internal Server Error: NullReferenceException in RankingService.',
    history: 'PPPPPPPPFF',
    expected: 'product_bug',
  },
  {
    id: 'T06',
    test: 'payments › refunds partial amount',
    error: 'Error: getaddrinfo ENOTFOUND payments-sandbox.internal — DNS lookup failed.',
    history: 'PPPPPPPPPF',
    expected: 'environment',
  },
  {
    id: 'T07',
    test: 'notifications › shows toast after save',
    error: 'AssertionError: expected toast to be visible. Toast appeared 3.2s after save, assertion checked at 3.0s. Passed on retry.',
    history: 'PPFPPPFPPF',
    expected: 'flaky',
  },
  {
    id: 'T08',
    test: 'reports › exports CSV with 3 columns',
    error: "AssertionError: expected ['name','email','created'] but got ['name','email','created','plan']. Product spec v2.3 added 'plan' column to exports.",
    history: 'PPPPPPPPPF',
    expected: 'test_bug',
  },
];
