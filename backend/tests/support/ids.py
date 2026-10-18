"""Fixed user ids, so assertions can name the user a row belongs to."""

import uuid

# The user every authed_client request is made as.
TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
# Someone else, for checking that their rows stay invisible.
OTHER_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
