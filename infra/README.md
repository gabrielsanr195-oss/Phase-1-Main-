# Infrastructure — Phase 1+

Terraform module for AWS. Provisions:

| Resource | Details |
|----------|---------|
| EC2 t3.medium | Ubuntu 22.04, nginx + Node.js 20 + Docker pre-installed |
| Elastic IP | Stable public IP attached to the EC2 |
| S3 bucket | Private, encrypted, versioned — for guest photos and uploads |
| IAM role | EC2 instance profile with read/write access to the S3 bucket only |
| Security group | SSH (restricted) + HTTP 80 + HTTPS 443 + port 3000 |

---

## Prerequisites

- [Terraform >= 1.7](https://developer.hashicorp.com/terraform/install)
- AWS credentials configured (`aws configure` or environment variables)
- An SSH key pair on your machine (`~/.ssh/id_rsa` + `id_rsa.pub`)

---

## First-time setup

```bash
cd infra/terraform

# 1. Copy and edit your variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set your SSH key path and restrict allowed_ssh_cidrs

# 2. Initialise Terraform
terraform init

# 3. Preview what will be created
terraform plan

# 4. Apply (creates all resources — takes ~2 min)
terraform apply
```

Terraform will print the outputs when done:

```
server_public_ip = "x.x.x.x"
ssh_command      = "ssh ubuntu@x.x.x.x"
s3_bucket_name   = "phase1plus-staging-123456789012"
```

---

## After apply — connect and deploy

```bash
# SSH into the server
ssh ubuntu@<server_public_ip>

# Clone the repo
cd /opt/phase1plus
git clone https://github.com/gabrielsanr195-oss/Phase-1-Main- .

# Copy and fill in environment variables
cp .env.example .env
nano .env   # Set DATABASE_URL, REDIS_URL, JWT_SECRET, STORAGE_BUCKET, etc.

# Install and build
pnpm install
pnpm --filter @phase1plus/types --filter @phase1plus/qr-lib build

# Run database migrations
pnpm --filter @phase1plus/api migrate

# Start the API (production)
pnpm --filter @phase1plus/api build
node apps/api/dist/index.js
```

---

## Environment variables to set after deploy

Copy values from `terraform output` into your server's `.env`:

```env
DATABASE_URL=postgresql://phase1plus:<DB_PASSWORD>@localhost:5432/phase1plus
REDIS_URL=redis://:<REDIS_PASSWORD>@localhost:6379
STORAGE_BUCKET=<s3_bucket_name from output>
STORAGE_REGION=us-east-1
```

---

## HTTPS (after you have a domain)

```bash
ssh ubuntu@<server_public_ip>
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Tear down

```bash
terraform destroy   # Destroys all resources — S3 bucket must be empty first
```
