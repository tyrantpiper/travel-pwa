# Oracle Cloud Free Tier Setup Guide

## 1. Registration
1.  Go to [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).
2.  Click **Start for Free**.
3.  **Region Selection**: This is critical. Choose a "Home Region" near your target users.
    > ⚠️ **Important Warning**: 
    > You might see a warning that **Tokyo (Japan East)** or **Seoul (South Korea)** has "High Demand" for Ampere A1. 
    > **If you see this, DO NOT choose Tokyo/Seoul.** You will likely fail to create the free instance later.
    >
    > **Recommended Alternatives (Clean Availability):**
    > - **Singapore** (Great for Asia)
    > - **United States West (Phoenix)** (Very stable, higher latency to Asia but acceptable for API)
    > - **Australia East (Sydney)**
    >
    > ⚠️ **Note**: You cannot change your Home Region later. The "Always Free" resources are only available in your Home Region.
4.  **Verification**:
    - **Address**: Please use **English** for all address fields.
        - **Address Line 1**: e.g., "No. 99, Sec. 3, Taiwan Blvd." (路名/號)
        - **Address Line 2**: e.g., "Xitun Dist." (區)
        - **City**: "Taichung City" (not "台中市")
        - **State/Province**: "Taiwan"
    - You will need a mobile phone number and a credit/debit card for identity verification.
    - You may see a temporary charge (approx $1 USD) which will be reversed.
    - If your card is rejected, try a different card or ensure international transactions are enabled.

## 2. Create VM Instance
Once logged in to the OCI Console:

1.  Click the **Hamburger Menu** (top left) -> **Compute** -> **Instances**.
2.  Click **Create Instance**.
3.  **Name**: Give it a name (e.g., `ryan-travel-backend`).
4.  **Placement**: Accept defaults (Availability Domain).
5.  **Image and Shape** (Crucial Step):
    - Click **Apps and Images** -> **Change Image**.
        - Choose **Oracle Linux 8** or **Ubuntu 22.04**.
    - Click **Shape** -> **Change Shape**.
        - Select **Ampere** series (ARM).
        - Check **VM.Standard.A1.Flex**.
        - Set OCPUs to **4**.
        - Set Memory to **24 GB**.
    > ✅ You should see a label "Always Free Eligible".
6.  **Networking**:
    - Select **Create new VCN** (if first time).
    - Ensure **Assign a public IPv4 address** is selected.
7.  **Add SSH Keys**:
    - Select **Generate a key pair for me**.
    - **Download Private Key** (`.key` file). **SAVE THIS FILE SAFE!** You cannot get it later.
    - **Download Public Key** (optional but good to have).
8.  **Boot Volume**: Default (usually 47GB) is fine for now, or specify up to 200GB.
9.  Click **Create**.

## 3. Post-Creation
1.  Wait for the instance state to turn **Running** (Green).
2.  Note down the **Public IP Address** displayed on the instance details page.
3.  You are now ready to deploy!
