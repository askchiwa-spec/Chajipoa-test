# ChajiPoa Production Infrastructure - Main Configuration
# Provider Configuration
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.9"
    }
  }
  backend "s3" {
    bucket         = "chajipoa-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "chajipoa-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "ChajiPoa"
      Environment = "Production"
      Owner       = "Infrastructure Team"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# VPC and Networking
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "chajipoa-production-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = "Production"
  }
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "chajipoa-production"
  cluster_version = "1.27"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    general = {
      desired_size = 3
      min_size     = 2
      max_size     = 10

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "general"
      }
    }

    critical = {
      desired_size = 2
      min_size     = 2
      max_size     = 5

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "critical"
      }
    }
  }

  tags = {
    Environment = "Production"
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "postgresql" {
  identifier             = "chajipoa-postgresql"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 100
  storage_type           = "gp3"
  storage_encrypted      = true
  username               = var.db_username
  password               = var.db_password
  db_name                = var.db_name
  parameter_group_name   = "default.postgres15"
  skip_final_snapshot    = false
  final_snapshot_identifier = "chajipoa-postgresql-final-snapshot"
  
  db_subnet_group_name   = aws_db_subnet_group.postgresql.name
  vpc_security_group_ids = [aws_security_group.postgresql.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  multi_az = true

  tags = {
    Name        = "chajipoa-postgresql"
    Environment = "Production"
  }
}

# DocumentDB (MongoDB Compatible)
resource "aws_docdb_cluster" "mongodb" {
  cluster_identifier      = "chajipoa-mongodb"
  engine                  = "docdb"
  master_username         = var.docdb_username
  master_password         = var.docdb_password
  backup_retention_period = 7
  preferred_backup_window = "07:00-09:00"

  vpc_security_group_ids = [aws_security_group.mongodb.id]
  db_subnet_group_name   = aws_db_subnet_group.mongodb.name

  tags = {
    Name        = "chajipoa-mongodb"
    Environment = "Production"
  }
}

resource "aws_docdb_cluster_instance" "mongodb_instances" {
  count              = 3
  identifier         = "chajipoa-mongodb-${count.index}"
  cluster_identifier = aws_docdb_cluster.mongodb.id
  instance_class     = "db.t4g.medium"

  tags = {
    Name        = "chajipoa-mongodb-instance-${count.index}"
    Environment = "Production"
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "chajipoa-redis"
  replication_group_description = "ChajiPoa Redis Cluster"
  node_type                  = "cache.t4g.small"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  engine_version             = "7.0"
  
  num_cache_clusters = 3
  automatic_failover_enabled = true
  
  security_group_ids = [aws_security_group.redis.id]
  subnet_group_name  = aws_elasticache_subnet_group.redis.name

  tags = {
    Name        = "chajipoa-redis"
    Environment = "Production"
  }
}

# Security Groups
resource "aws_security_group" "postgresql" {
  name        = "chajipoa-postgresql-sg"
  description = "Security group for PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "mongodb" {
  name        = "chajipoa-mongodb-sg"
  description = "Security group for MongoDB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 27017
    to_port     = 27017
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "redis" {
  name        = "chajipoa-redis-sg"
  description = "Security group for Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Subnet Groups
resource "aws_db_subnet_group" "postgresql" {
  name       = "chajipoa-postgresql-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "chajipoa-postgresql-subnet-group"
  }
}

resource "aws_db_subnet_group" "mongodb" {
  name       = "chajipoa-mongodb-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "chajipoa-mongodb-subnet-group"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "chajipoa-redis-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "chajipoa-redis-subnet-group"
  }
}

# Outputs
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "Kubernetes Cluster Name"
  value       = module.eks.cluster_name
}

output "postgresql_endpoint" {
  description = "PostgreSQL endpoint"
  value       = aws_db_instance.postgresql.endpoint
}

output "mongodb_endpoint" {
  description = "MongoDB endpoint"
  value       = aws_docdb_cluster.mongodb.endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}