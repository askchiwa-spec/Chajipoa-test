# Cluster Information
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "Kubernetes Cluster Name"
  value       = module.eks.cluster_name
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

# Database Endpoints
output "postgresql_endpoint" {
  description = "PostgreSQL endpoint"
  value       = aws_db_instance.postgresql.endpoint
}

output "postgresql_port" {
  description = "PostgreSQL port"
  value       = aws_db_instance.postgresql.port
}

output "mongodb_endpoint" {
  description = "MongoDB endpoint"
  value       = aws_docdb_cluster.mongodb.endpoint
}

output "mongodb_port" {
  description = "MongoDB port"
  value       = 27017
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = 6379
}

# Network Information
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

# Security Group IDs
output "postgresql_security_group_id" {
  description = "PostgreSQL security group ID"
  value       = aws_security_group.postgresql.id
}

output "mongodb_security_group_id" {
  description = "MongoDB security group ID"
  value       = aws_security_group.mongodb.id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

# Node Group Information
output "node_group_general_arn" {
  description = "ARN of the general node group"
  value       = module.eks.eks_managed_node_groups["general"].arn
}

output "node_group_critical_arn" {
  description = "ARN of the critical node group"
  value       = module.eks.eks_managed_node_groups["critical"].arn
}

# IAM Roles
output "cluster_iam_role_arn" {
  description = "IAM role ARN for the cluster"
  value       = module.eks.cluster_iam_role_arn
}

output "node_group_general_iam_role_arn" {
  description = "IAM role ARN for general node group"
  value       = module.eks.eks_managed_node_groups["general"].iam_role_arn
}

output "node_group_critical_iam_role_arn" {
  description = "IAM role ARN for critical node group"
  value       = module.eks.eks_managed_node_groups["critical"].iam_role_arn
}

# Monitoring and Logging
output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = "/aws/eks/${module.eks.cluster_name}/cluster"
}

# Cost Information
output "estimated_monthly_cost" {
  description = "Estimated monthly infrastructure cost (USD)"
  value       = "Approximately $1,200-1,800/month"
}

# Next Steps
output "next_steps" {
  description = "Instructions for next steps"
  value       = <<EOT
1. Configure kubectl: aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}
2. Deploy Kubernetes manifests from k8s/ directory
3. Configure DNS records to point to Load Balancer
4. Set up monitoring and alerting
5. Configure backup and disaster recovery
6. Set up CI/CD pipeline for deployments
EOT
}