# @vaultfolio/requests

Data-only registry for user requests (feature + request type, statuses, limits). It imports nothing
from any feature library, so the backend, the admin UI and a feature can all depend on it. A new
request type is one row in `REQUEST_TYPES` plus a backend handler.
