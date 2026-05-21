variable "project_name" {
  description = "Identifier used in resource names and tags"
  type        = string
  default     = "phase1plus"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "public_key_path" {
  description = "Path to your local SSH public key — used to create the EC2 key pair"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to SSH into the EC2 instance. Restrict to your IP(s)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "app_port" {
  description = "Port the Node.js API listens on (nginx proxies 80/443 → this)"
  type        = number
  default     = 3000
}

variable "s3_cors_origins" {
  description = "Origins allowed to make browser requests to S3 (CORS)"
  type        = list(string)
  default     = ["*"]
}
