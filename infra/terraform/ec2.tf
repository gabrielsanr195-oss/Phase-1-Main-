# SSH key pair — provide the path to your existing public key
resource "aws_key_pair" "phase1plus" {
  key_name   = "${var.project_name}-${var.environment}"
  public_key = file(var.public_key_path)

  tags = {
    Name = "${var.project_name}-${var.environment}-keypair"
  }
}

# EC2 instance — runs the API, nginx, Docker (PostgreSQL + Redis)
resource "aws_instance" "api_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.phase1plus.key_name
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.api_server.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  # 30 GB root volume — enough for Docker images + logs
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${var.project_name}-${var.environment}-root-vol"
    }
  }

  user_data                   = file("${path.module}/user_data.sh")
  user_data_replace_on_change = true

  # Prevent accidental termination in production
  disable_api_termination = var.environment == "production"

  tags = {
    Name = "${var.project_name}-${var.environment}-api"
  }

  lifecycle {
    # Don't replace the instance just because a newer AMI was published
    ignore_changes = [ami]
  }
}

# Elastic IP — keeps the server address stable across stop/start
resource "aws_eip" "api_server" {
  instance = aws_instance.api_server.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-eip"
  }
}
