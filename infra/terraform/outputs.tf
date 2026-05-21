output "server_public_ip" {
  description = "Elastic IP of the API server — use this in your DNS A record"
  value       = aws_eip.api_server.public_ip
}

output "server_public_dns" {
  description = "EC2 public DNS (changes on reboot; prefer the Elastic IP)"
  value       = aws_eip.api_server.public_dns
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh ubuntu@${aws_eip.api_server.public_ip}"
}

output "s3_bucket_name" {
  description = "S3 bucket name — set as STORAGE_BUCKET in your .env"
  value       = aws_s3_bucket.app_storage.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.app_storage.arn
}

output "s3_bucket_region" {
  description = "S3 bucket region — set as STORAGE_REGION in your .env"
  value       = aws_s3_bucket.app_storage.region
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.api_server.id
}

output "ami_used" {
  description = "Ubuntu AMI used for this deploy"
  value       = data.aws_ami.ubuntu.id
}
